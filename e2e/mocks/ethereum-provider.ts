/**
 * Mock EIP-1193 Ethereum provider injected via page.addInitScript().
 * This script runs in the browser context before the app loads.
 */

interface MockProviderConfig {
  chainIdHex: string
  accounts: string[]
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
