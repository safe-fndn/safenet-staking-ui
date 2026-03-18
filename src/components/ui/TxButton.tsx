import * as React from "react"
import { Button, type ButtonProps } from "./button"
import Loader2 from "lucide-react/dist/esm/icons/loader-2"
import { useWrongNetwork } from "@/hooks/useWrongNetwork"

interface TxButtonProps extends ButtonProps {
  /** True while the user is signing the transaction in their wallet. */
  isSigningTx: boolean
  /** True while the signed transaction is confirming onchain. */
  isConfirmingTx: boolean
  /** Label shown during the signing phase. */
  signingLabel?: string
  /** Label shown during the onchain confirmation phase. */
  confirmingLabel?: string
}

/**
 * A Button that shows a spinning loader and contextual label
 * while a blockchain transaction is being signed or confirmed.
 *
 * The button is automatically disabled when either phase is active,
 * in addition to any explicit `disabled` prop.
 */
const TxButton = React.forwardRef<HTMLButtonElement, TxButtonProps>(
  (
    {
      isSigningTx,
      isConfirmingTx,
      signingLabel = "Confirm in Wallet\u2026",
      confirmingLabel = "Confirming onchain\u2026",
      disabled,
      children,
      ...rest
    },
    ref,
  ) => {
    const wrongNetwork = useWrongNetwork()
    const isBusy = isSigningTx || isConfirmingTx

    return (
      <Button
        ref={ref}
        disabled={disabled || isBusy || wrongNetwork}
        {...rest}
      >
        {isSigningTx ? (
          <>
            <Loader2
              className="animate-spin"
              aria-hidden="true"
            />
            {signingLabel}
          </>
        ) : isConfirmingTx ? (
          <>
            <Loader2
              className="animate-spin"
              aria-hidden="true"
            />
            {confirmingLabel}
          </>
        ) : (
          children
        )}
      </Button>
    )
  },
)
TxButton.displayName = "TxButton"

export { TxButton }
export type { TxButtonProps }
