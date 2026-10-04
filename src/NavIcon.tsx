export function NavIcon({ index }: { index: number }) {
  const paths = [
    <>
      <path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z" />
      <path d="M9 3v16M15 5v16" />
    </>,
    <>
      <path d="M14 2H5v20h14V7Z" />
      <path d="M14 2v5h5M8 12h8M8 16h5" />
    </>,
    <>
      <path d="M4 7h15l-3-3M20 17H5l3 3" />
      <path d="M19 7l-3 3M5 17l3-3" />
    </>,
    <>
      <path d="m12 3 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" />
      <path d="m19 16 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" />
    </>,
    <>
      <path d="M3 19h18M5 15l5-5 4 2 6-8M16 4h4v4" />
    </>,
    <>
      <path d="M7 17h10a4 4 0 0 0 0-8 5 5 0 0 0-9-2 5 5 0 0 0-1 10Z" />
      <path d="m8 20-1 2m6-2-1 2m6-2-1 2" />
    </>,
    <>
      <path d="M4 5v14h17M8 15v-4m5 4V7m5 8v-6" />
    </>,
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0" />
    </>,
    <>
      <path d="M5 5h14v11H9l-4 4Z" />
      <path d="m12 7 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" />
    </>,
  ];
  return (
    <svg
      className="nav-icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[index]}
    </svg>
  );
}
