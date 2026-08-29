import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'default' | 'ghost'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'default', size = 'md', className, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-sm font-medium whitespace-nowrap transition-colors duration-100',
        'focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'h-7 px-2.5 text-[13px]' : 'h-8 px-3 text-sm',
        variant === 'primary' && 'bg-accent text-white hover:bg-accent-hover',
        variant === 'default' &&
          'border border-border bg-white text-text shadow-card hover:bg-bg-hover',
        variant === 'ghost' && 'text-text-2 hover:bg-bg-hover hover:text-text',
        className,
      )}
    />
  )
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx('rounded-md border border-border bg-white', className)} />
}

export function Chip({
  active,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...rest}
      className={cx(
        'rounded-xs px-2 py-1 text-[13px] transition-colors duration-100',
        active ? 'bg-accent-bg text-accent-hover' : 'text-text-2 hover:bg-bg-hover hover:text-text',
        className,
      )}
    />
  )
}

/** Notion's property row: a muted label in a fixed column, value beside it. */
export function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="w-[112px] shrink-0 truncate text-[13px] text-text-3">{label}</span>
      <span className="min-w-0 text-[13px] text-text">{children}</span>
    </div>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pt-4 pb-1 text-[11px] font-semibold tracking-wide text-text-3">
      {children}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-2 text-2xl">{icon}</span>
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <p className="mt-1 max-w-[38ch] text-[13px] leading-relaxed text-text-2">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
