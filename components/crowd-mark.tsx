type CrowdMarkProps = {
  size?: number
  className?: string
}

export function CrowdMark({
  size = 24,
  className = '',
}: CrowdMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* heads */}
      <circle cx="8" cy="20" r="4.5" fill="currentColor" opacity="0.78" />
      <circle cx="16" cy="15" r="5" fill="currentColor" opacity="0.86" />
      <circle cx="25" cy="11.5" r="5.5" fill="currentColor" />
      <circle cx="32" cy="9" r="6" fill="currentColor" />
      <circle cx="39" cy="11.5" r="5.5" fill="currentColor" />
      <circle cx="48" cy="15" r="5" fill="currentColor" opacity="0.86" />
      <circle cx="56" cy="20" r="4.5" fill="currentColor" opacity="0.78" />

      {/* bodies */}
      <path
        d="M1.5 39.5C1.5 33.15 5.15 29 10 29C13.1 29 15.7 30.7 17.15 33.55C15.05 35.95 13.8 39.1 13.8 42.55V47H6.2C3.6 47 1.5 44.9 1.5 42.3V39.5Z"
        fill="currentColor"
        opacity="0.72"
      />
      <path
        d="M9.5 34.3C9.5 27.5 13.9 23 19.5 23C23.2 23 26.35 24.95 28.1 28.1C24.55 31.15 22.3 35.65 22.3 40.7V49H15C11.95 49 9.5 46.55 9.5 43.5V34.3Z"
        fill="currentColor"
        opacity="0.84"
      />
      <path
        d="M17.5 37C17.5 28.95 22.9 23.5 29.5 23.5C31.1 23.5 32.6 23.8 34 24.35C29.75 27.6 27 32.75 27 38.6V52H23.7C20.25 52 17.5 49.25 17.5 45.8V37Z"
        fill="currentColor"
        opacity="0.94"
      />
      <path
        d="M25 37.2C25 28.7 30.2 23 36.5 23C42.8 23 48 28.7 48 37.2V50.6C48 54.15 45.15 57 41.6 57H31.4C27.85 57 25 54.15 25 50.6V37.2Z"
        fill="currentColor"
      />
      <path
        d="M37 38.6C37 32.75 34.25 27.6 30 24.35C31.4 23.8 32.9 23.5 34.5 23.5C41.1 23.5 46.5 28.95 46.5 37V45.8C46.5 49.25 43.75 52 40.3 52H37V38.6Z"
        fill="currentColor"
        opacity="0.94"
      />
      <path
        d="M41.9 28.1C43.65 24.95 46.8 23 50.5 23C56.1 23 60.5 27.5 60.5 34.3V43.5C60.5 46.55 58.05 49 55 49H47.7V40.7C47.7 35.65 45.45 31.15 41.9 28.1Z"
        fill="currentColor"
        opacity="0.84"
      />
      <path
        d="M46.85 33.55C48.3 30.7 50.9 29 54 29C58.85 29 62.5 33.15 62.5 39.5V42.3C62.5 44.9 60.4 47 57.8 47H50.2V42.55C50.2 39.1 48.95 35.95 46.85 33.55Z"
        fill="currentColor"
        opacity="0.72"
      />
    </svg>
  )
}
