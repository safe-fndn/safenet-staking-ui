interface PageHeroProps {
  illustration: string
  illustrationDark?: string
  illustrationAlt: string
  title: string
  subtitle: string
  children?: React.ReactNode
}

export function PageHero({
  illustration,
  illustrationDark,
  illustrationAlt,
  title,
  subtitle,
  children,
}: PageHeroProps) {
  return (
    <div className="relative overflow-hidden border border-black/12 dark:border-[#12FF80]/20 p-6 min-h-[300px] flex items-center justify-center">
      {/* Checkerboard grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.14]"
        style={{
          backgroundImage: `
            linear-gradient(45deg, #03843E 25%, transparent 25%),
            linear-gradient(-45deg, #03843E 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #03843E 75%),
            linear-gradient(-45deg, transparent 75%, #03843E 75%)
          `,
          backgroundSize: "8px 8px",
          backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
        }}
      />

      {/* Content */}
      <div className="relative flex flex-col items-center text-center px-4 gap-8">
        <img
          src={illustration}
          alt={illustrationAlt}
          className={illustrationDark ? "h-28 w-auto md:h-36 dark:hidden" : "h-28 w-auto md:h-36"}
        />
        {illustrationDark && (
          <img
            src={illustrationDark}
            alt={illustrationAlt}
            className="h-28 w-auto md:h-36 hidden dark:block"
          />
        )}
        <div>
          <h1 className="font-heading text-4xl md:text-5xl lg:text-[56px] font-normal tracking-[-0.02em] leading-none">
            {title}
          </h1>
          <p className="mt-6 text-sm md:text-lg uppercase tracking-[-0.02em] text-foreground/50 font-mono opacity-[0.56]">
            {subtitle}
          </p>
          {children}
        </div>
      </div>
    </div>
  )
}
