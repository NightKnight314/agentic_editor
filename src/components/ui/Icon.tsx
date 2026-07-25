import type { SVGProps } from "react";

const paths: Record<string, React.ReactNode> = {
  play: <path d="m8 5 11 7-11 7V5Z" fill="currentColor" stroke="none" />,
  pause: <><path d="M8 5v14M16 5v14" /><path d="M8 5v14M16 5v14" strokeWidth="3" /></>,
  back: <><path d="m11 7-5 5 5 5" /><path d="M18 7v10" /></>,
  forward: <><path d="m13 7 5 5-5 5" /><path d="M6 7v10" /></>,
  upload: <><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" /><path d="M5 14v5h14v-5" /></>,
  export: <><path d="M12 15V3m0 0 4.5 4.5M12 3 7.5 7.5" /><path d="M5 13v7h14v-7" /></>,
  sparkle: <><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z" /><path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" /></>,
  media: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 15 3-3 3 3 2-2 3 3M8 8h.01" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  video: <><rect x="3" y="6" width="14" height="12" rx="2" /><path d="m17 10 4-2v8l-4-2" /></>,
  audio: <path d="M4 13v-2m4 6V7m4 13V4m4 13V7m4 6v-2" />,
  text: <><path d="M5 5h14M12 5v14M8 19h8" /></>,
  eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
  lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  volume: <><path d="M5 10H2v4h3l4 3V7l-4 3Z" /><path d="M13 9a4 4 0 0 1 0 6M16 6a8 8 0 0 1 0 12" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  undo: <><path d="m9 8-4 4 4 4" /><path d="M5 12h8a6 6 0 0 1 6 6" /></>,
  redo: <><path d="m15 8 4 4-4 4" /><path d="M19 12h-8a6 6 0 0 0-6 6" /></>,
  scissors: <><circle cx="6" cy="7" r="3" /><circle cx="6" cy="17" r="3" /><path d="m8.5 8.5 11 7.5M8.5 15.5l11-7.5" /></>,
  cursor: <path d="m5 3 13 9-6 1-3 6L5 3Z" />,
  chevron: <path d="m8 10 4 4 4-4" />,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
  send: <><path d="m3 11 18-8-8 18-2-8-8-2Z" /><path d="m11 13 5-5" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  wand: <><path d="m4 20 11-11M13 5l2-2 6 6-2 2M5 4v3M3.5 5.5h3M19 15v4M17 17h4" /></>,
  cloud: <path d="M7 18h11a4 4 0 0 0 .5-8A6.5 6.5 0 0 0 6 8.5 4.8 4.8 0 0 0 7 18Z" />,
  command: <><path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6Z" /></>
};

export function Icon({ name, size = 18, ...props }: SVGProps<SVGSVGElement> & { name: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name] ?? paths.sparkle}
    </svg>
  );
}
