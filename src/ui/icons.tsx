/**
 * Icon set.
 *
 * One stroke weight, one 24-unit grid, sized by the `size` prop so an icon
 * never arrives at an arbitrary dimension. Decorative by default
 * (`aria-hidden`); pass a `title` when an icon is the only label.
 */

import type { SVGProps } from 'react'

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number
  title?: string
}

function Icon({ size = 16, title, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

export const TruckIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3 7.5h10.5v9H3zM13.5 11h4l3 3v2.5h-7z" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></Icon>
)
export const UsersIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" /><path d="M16 5.4a3.2 3.2 0 0 1 0 5.6M17.2 14.6c2 .7 3.3 2.2 3.3 4.4" /></Icon>
)
export const RouteIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.5 6H14a3.5 3.5 0 0 1 0 7h-4a3.5 3.5 0 0 0 0 7h5.5" /></Icon>
)
export const FuelIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 20V5.5A1.5 1.5 0 0 1 5.5 4h6A1.5 1.5 0 0 1 13 5.5V20M3 20h11" /><path d="M13 10h3.5a1.5 1.5 0 0 1 1.5 1.5v4.8a1.7 1.7 0 0 0 3.4 0V9l-2.4-2.4" /><path d="M6.5 8.5h4" /></Icon>
)
export const ReceiptIcon = (p: IconProps) => (
  <Icon {...p}><path d="M5.5 3.5h13v17l-2.2-1.4-2.2 1.4-2.1-1.4-2.2 1.4-2.1-1.4-2.2 1.4z" /><path d="M9 8.5h6M9 12.5h6" /></Icon>
)
export const WrenchIcon = (p: IconProps) => (
  <Icon {...p}><path d="M15.5 3.5a5 5 0 0 0-4.6 7l-7 7a1.8 1.8 0 0 0 2.6 2.6l7-7a5 5 0 0 0 6.1-6.5l-2.8 2.8-2.5-2.5 2.8-2.8a5 5 0 0 0-1.6-.6z" /></Icon>
)
export const ChartIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 20h16" /><path d="M6.5 20V12M11.5 20V5.5M16.5 20v-5.5" /></Icon>
)
export const FileIcon = (p: IconProps) => (
  <Icon {...p}><path d="M13.5 3.5H6.5A1.5 1.5 0 0 0 5 5v14a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V9z" /><path d="M13.5 3.5V9H19M8.5 13h7M8.5 16.5h5" /></Icon>
)
export const PlusIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>
)
export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}><path d="M9.5 5.5 16 12l-6.5 6.5" /></Icon>
)
export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}><path d="M14.5 5.5 8 12l6.5 6.5" /></Icon>
)
export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}><path d="M5.5 9.5 12 16l6.5-6.5" /></Icon>
)
export const CloseIcon = (p: IconProps) => (
  <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>
)
export const CheckIcon = (p: IconProps) => (
  <Icon {...p}><path d="m4.5 12.5 5 5 10-11" /></Icon>
)
export const AlertTriangleIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 4.2 21 19.5H3z" /><path d="M12 10v4M12 17h.01" /></Icon>
)
export const AlertCircleIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5M12 16h.01" /></Icon>
)
export const InfoIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 8h.01" /></Icon>
)
export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5" /><path d="M4.5 17v2.5h15V17" /></Icon>
)
export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="1.8" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></Icon>
)
export const GaugeIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 17a8.5 8.5 0 1 1 16 0" /><path d="M12 17l4-5" /><circle cx="12" cy="17" r="1.2" /></Icon>
)
export const MapPinIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 21s6.5-5.6 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15.4 12 21 12 21z" /><circle cx="12" cy="10.5" r="2.4" /></Icon>
)
export const PhoneIcon = (p: IconProps) => (
  <Icon {...p}><path d="M6.2 3.5h3l1.5 4-2 1.4a11.5 11.5 0 0 0 5.4 5.4l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.2 5.7a2 2 0 0 1 2-2.2z" /></Icon>
)
export const IdCardIcon = (p: IconProps) => (
  <Icon {...p}><rect x="2.5" y="5" width="19" height="14" rx="2" /><circle cx="8.5" cy="11" r="2.1" /><path d="M5 16.2c.6-1.4 2-2.1 3.5-2.1s2.9.7 3.5 2.1M15 10h4M15 13.5h3" /></Icon>
)
export const TrashIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 6.5h16M9 6.5V4.2h6v2.3" /><path d="M6.5 6.5 7.4 20h9.2l.9-13.5" /><path d="M10.5 10v6M13.5 10v6" /></Icon>
)
export const EditIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 20h4L19 9a2.4 2.4 0 0 0-3.4-3.4L4.5 16.7z" /><path d="M14.5 7 17 9.5" /></Icon>
)
export const ArrowUpRightIcon = (p: IconProps) => (
  <Icon {...p}><path d="M7 17 17 7M9 7h8v8" /></Icon>
)
export const ArrowDownRightIcon = (p: IconProps) => (
  <Icon {...p}><path d="M7 7l10 10M17 9v8H9" /></Icon>
)
export const SearchIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4.5 4.5" /></Icon>
)
export const InboxIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3.5 13.5h4l1.5 3h6l1.5-3h4" /><path d="M5.8 4.5h12.4l2.3 9V18a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-4.5z" /></Icon>
)
export const ClockIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5.3l3.2 2" /></Icon>
)
export const BellIcon = (p: IconProps) => (
  <Icon {...p}><path d="M6 10a6 6 0 1 1 12 0c0 3.4.8 5 1.8 6H4.2C5.2 15 6 13.4 6 10z" /><path d="M10 19.5a2.2 2.2 0 0 0 4 0" /></Icon>
)
export const WalletIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h11a2 2 0 0 1 2 2" /><rect x="3.5" y="7.5" width="17" height="11.5" rx="2" /><path d="M16 13.2h2.5" /></Icon>
)
export const RupeeIcon = (p: IconProps) => (
  <Icon {...p}><path d="M7 4.5h10M7 9h10M7 4.5c5 0 7 1.5 7 4.5s-2 4.5-7 4.5h1.5L16 19.5" /></Icon>
)
