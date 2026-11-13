"use client"

import { motion, type Variants } from "motion/react"
import {
  getVariants,
  IconWrapper,
  useAnimateIconContext,
  type IconProps,
} from "@animate-ui/react/icons"

const pulseBounceAnimations = {
  default: {
    group: {
      initial: { scale: 1, rotate: 0 },
      animate: {
        scale: [1, 0.9, 1.12, 1],
        rotate: [0, -4, 4, 0],
        transition: { duration: 0.55, ease: "easeInOut" },
      },
    },
  } satisfies Record<string, Variants>,
} as const

type StudioIconProps = IconProps<keyof typeof pulseBounceAnimations>

function PlaySvg({ size, ...props }: StudioIconProps) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(pulseBounceAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <polygon points="6 3 20 12 6 21 6 3" />
      </motion.g>
    </motion.svg>
  )
}

export function PlayIcon(props: StudioIconProps) {
  return <IconWrapper icon={PlaySvg} {...props} />
}

function PauseSvg({ size, ...props }: StudioIconProps) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(pulseBounceAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <rect x="6" y="4" width="4" height="16" rx="1" />
        <rect x="14" y="4" width="4" height="16" rx="1" />
      </motion.g>
    </motion.svg>
  )
}

export function PauseIcon(props: StudioIconProps) {
  return <IconWrapper icon={PauseSvg} {...props} />
}

function ShieldCheckSvg({ size, ...props }: StudioIconProps) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(pulseBounceAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        <path d="m9 12 2 2 4-4" />
      </motion.g>
    </motion.svg>
  )
}

export function ShieldCheckIcon(props: StudioIconProps) {
  return <IconWrapper icon={ShieldCheckSvg} {...props} />
}

function CpuSvg({ size, ...props }: StudioIconProps) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(pulseBounceAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <rect width="16" height="16" x="4" y="4" rx="2" />
        <rect width="6" height="6" x="9" y="9" rx="1" />
        <path d="M15 2v2" />
        <path d="M15 20v2" />
        <path d="M2 15h2" />
        <path d="M2 9h2" />
        <path d="M20 15h2" />
        <path d="M20 9h2" />
        <path d="M9 2v2" />
        <path d="M9 20v2" />
      </motion.g>
    </motion.svg>
  )
}

export function CpuIcon(props: StudioIconProps) {
  return <IconWrapper icon={CpuSvg} {...props} />
}

function WindowsSvg({ size, ...props }: StudioIconProps) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(pulseBounceAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <rect x="3" y="3" width="8.2" height="8.2" rx="1.2" />
        <rect x="12.8" y="3" width="8.2" height="8.2" rx="1.2" />
        <rect x="3" y="12.8" width="8.2" height="8.2" rx="1.2" />
        <rect x="12.8" y="12.8" width="8.2" height="8.2" rx="1.2" />
      </motion.g>
    </motion.svg>
  )
}

export function WindowsIcon(props: StudioIconProps) {
  return <IconWrapper icon={WindowsSvg} {...props} />
}

function AndroidSvg({ size, ...props }: StudioIconProps) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(pulseBounceAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <path d="M5 16V15a7 7 0 0 1 14 0v1" />
        <path d="M4 16h16a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a1 1 0 0 1 1-1Z" />
        <path d="m8 6-2-3" />
        <path d="m16 6 2-3" />
        <circle cx="9" cy="12" r="1" fill="currentColor" />
        <circle cx="15" cy="12" r="1" fill="currentColor" />
      </motion.g>
    </motion.svg>
  )
}

export function AndroidIcon(props: StudioIconProps) {
  return <IconWrapper icon={AndroidSvg} {...props} />
}

function GithubSvg({ size, ...props }: StudioIconProps) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(pulseBounceAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
        <path d="M9 18c-4.51 2-5-2-7-2" />
      </motion.g>
    </motion.svg>
  )
}

export function GithubIcon(props: StudioIconProps) {
  return <IconWrapper icon={GithubSvg} {...props} />
}

function CheckSvg({ size, ...props }: StudioIconProps) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(pulseBounceAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <path d="M20 6 9 17l-5-5" />
      </motion.g>
    </motion.svg>
  )
}

export function CheckIcon(props: StudioIconProps) {
  return <IconWrapper icon={CheckSvg} {...props} />
}

function ZapSvg({ size, ...props }: StudioIconProps) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(pulseBounceAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
      </motion.g>
    </motion.svg>
  )
}

export function ZapIcon(props: StudioIconProps) {
  return <IconWrapper icon={ZapSvg} {...props} />
}

function CopyGlyphSvg({ size, ...props }: StudioIconProps) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(pulseBounceAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
      </motion.g>
    </motion.svg>
  )
}

export function CopyGlyphIcon(props: StudioIconProps) {
  return <IconWrapper icon={CopyGlyphSvg} {...props} />
}
