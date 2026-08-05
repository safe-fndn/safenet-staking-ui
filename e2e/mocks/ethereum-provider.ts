/**
 * Mock EIP-1193 Ethereum provider injected via page.addInitScript().
 * This script runs in the browser context before the app loads.
 */

interface MockProviderConfig {
  chainIdHex: string
  accounts: string[]
  /** Advertise EIP-5792 atomicBatch support (wallet_getCapabilities/sendCalls/getCallsStatus). */
  supportsBatching?: boolean
}

export function createEthereumProviderScript(config: MockProviderConfig): string {
  return `
    (() => {
      const config = ${JSON.stringify(config)};
      const listeners = {};

      const provider = {
        isMetaMask: true,
        _metamask: { isUnlocked: () => Promise.resolve(true) },
        chainId: config.chainIdHex,
        networkVersion: String(parseInt(config.chainIdHex, 16)),
        selectedAddress: config.accounts[0] || null,

        on(event, handler) {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(handler);
          return provider;
        },

        removeListener(event, handler) {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter(h => h !== handler);
          }
          return provider;
        },

        removeAllListeners(event) {
          if (event) {
            delete listeners[event];
          } else {
            Object.keys(listeners).forEach(k => delete listeners[k]);
          }
          return provider;
        },

        emit(event, ...args) {
          if (listeners[event]) {
            listeners[event].forEach(h => {
              try { h(...args); } catch (e) { console.error('Provider event error:', e); }
            });
          }
        },

        async request({ method, params }) {
          switch (method) {
            case 'eth_requestAccounts':
            case 'eth_accounts':
              return config.accounts;
            case 'eth_chainId':
              return config.chainIdHex;
            case 'net_version':
              return String(parseInt(config.chainIdHex, 16));
            case 'wallet_switchEthereumChain':
              return null;
            case 'eth_sendTransaction':
              // Let a test simulate the user rejecting the wallet prompt.
              if (window.__shouldRejectTx && await window.__shouldRejectTx()) {
                const rejected = new Error('User rejected the request.');
                rejected.code = 4001;
                throw rejected;
              }
              // Report the submitted call back to the Node-side mock chain state
              // (see mock-chain-state.ts) so subsequent reads reflect the "transaction".
              if (window.__mockTx && params[0] && params[0].data) {
                await window.__mockTx(params[0].data);
              }
              // Return a deterministic mock tx hash
              return '${`0x${"a".repeat(64)}`}';
            case 'personal_sign':
              return '0x' + 'ab'.repeat(65);
            case 'eth_getBalance':
              return '0x56BC75E2D63100000'; // 100 ETH
            case 'eth_getTransactionCount':
              return '0x1';
            case 'wallet_getPermissions':
              return [{ parentCapability: 'eth_accounts' }];
            case 'wallet_requestPermissions':
              return [{ parentCapability: 'eth_accounts' }];
            case 'wallet_getCapabilities':
              // EIP-5792. Only advertised for tests that opt in (see batchingPage fixture) —
              // most existing tests rely on this being unsupported (throwing below) so the
              // app falls back to the sequential approve-then-stake flow.
              if (!config.supportsBatching) throw new Error('MockProvider: unhandled method wallet_getCapabilities');
              return { [config.chainIdHex]: { atomicBatch: { supported: true } } };
            case 'wallet_sendCalls': {
              const calls = (params[0] && params[0].calls) || [];
              for (const call of calls) {
                if (window.__mockTx && call.data) await window.__mockTx(call.data);
              }
              return '${`0x${"5".repeat(64)}`}';
            }
            case 'wallet_getCallsStatus':
              return {
                version: '2.0.0',
                id: params[0],
                chainId: config.chainIdHex,
                status: 200,
                receipts: [{
                  logs: [],
                  status: '0x1',
                  blockHash: '0x' + 'bb'.repeat(32),
                  blockNumber: '0x6000000',
                  gasUsed: '0x30d40',
                  transactionHash: '${`0x${"5".repeat(64)}`}',
                }],
              };
            default:
              // Fall through to the RPC handler for contract calls
              throw new Error('MockProvider: unhandled method ' + method);
          }
        }
      };

      // Expose globally for wagmi's injected connector detection
      window.ethereum = provider;

      // Also announce as EIP-6963
      window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
        detail: {
          info: { uuid: 'mock-wallet', name: 'Mock Wallet', icon: 'data:image/svg+xml,<svg/>', rdns: 'io.mock.wallet' },
          provider
        }
      }));
    })();
  `
}

/**
 * Script to create a disconnected wallet state (no accounts).
 */
export function createDisconnectedProviderScript(chainIdHex: string): string {
  return createEthereumProviderScript({ chainIdHex, accounts: [] })
}
