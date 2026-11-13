'use client';

import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@animate-ui/react/icons';

// Controles da janela no estilo do Windows (traço fino, sem arredondar demais),
// no mesmo formato dos ícones do Animate UI. `restore` desenha os dois quadrados
// da janela maximizada.

type WindowMaximizeProps = IconProps<keyof typeof animations> & { restore?: boolean };

const animations = {
  default: {
    front: {
      initial: { scale: 1, transition: { duration: 0.25, ease: 'easeOut' } },
      animate: {
        scale: [1, 1.14, 1],
        transition: { duration: 0.45, ease: 'easeInOut' },
      },
    },
    back: {
      initial: { x: 0, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
      animate: {
        x: [0, 1, 0],
        y: [0, -1, 0],
        transition: { duration: 0.45, ease: 'easeInOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, restore = false, ...props }: WindowMaximizeProps) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);
  const origin = { transformOrigin: '50% 50%', transformBox: 'fill-box' as const };

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {restore ? (
        <>
          <motion.path
            d="M9 6V5.5A1.5 1.5 0 0 1 10.5 4h8A1.5 1.5 0 0 1 20 5.5v8a1.5 1.5 0 0 1-1.5 1.5H18"
            variants={variants.back}
            initial="initial"
            animate={controls}
          />
          <motion.rect
            x={4}
            y={9}
            width={11}
            height={11}
            rx={1.5}
            style={origin}
            variants={variants.front}
            initial="initial"
            animate={controls}
          />
        </>
      ) : (
        <motion.rect
          x={5}
          y={5}
          width={14}
          height={14}
          rx={1.5}
          style={origin}
          variants={variants.front}
          initial="initial"
          animate={controls}
        />
      )}
    </motion.svg>
  );
}

function WindowMaximize(props: WindowMaximizeProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  WindowMaximize,
  WindowMaximize as WindowMaximizeIcon,
  type WindowMaximizeProps,
  type WindowMaximizeProps as WindowMaximizeIconProps,
};
