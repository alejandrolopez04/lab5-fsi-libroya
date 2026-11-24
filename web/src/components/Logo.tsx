// Logo de LibroYa: libro abierto con marcapáginas y líneas de velocidad ("¡ya!").
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#1c1917" />
      <path d="M6 24h9M4 32h11M6 40h9" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
      <path d="M20 20c5-3 10-3 14 0v26c-4-3-9-3-14 0z" fill="#fafaf9" />
      <path d="M34 20c4-3 9-3 14 0v26c-5-3-10-3-14 0z" fill="#e7e5e4" />
      <path d="M41 18v13l3-2.5 3 2.5V18.5c-2-.6-4-.8-6-.5z" fill="#fbbf24" />
      <path d="M24 28h7M24 33h7M24 38h5" stroke="#a8a29e" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
