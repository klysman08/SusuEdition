'use client';

import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@animate-ui/react/icons';

// Não existe no registro do Animate UI: segue o mesmo formato dos ícones de lá.
// O retângulo deita e volta, lembrando a troca de formato (9:16 ↔ 16:9).

type RectangleVerticalProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    rect: {
      initial: { rotate: 0, transition: { duration: 0.45, ease: 'easeInOut' } },
      animate: {
        rotate: [0, 90, 90, 0],
        transition: { duration: 1.1, times: [0, 0.35, 0.65, 1], ease: 'easeInOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: RectangleVerticalProps) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

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
      <motion.rect
        width={12}
        height={20}
        x={6}
        y={2}
        rx={2}
        style={{ transformOrigin: '50% 50%', transformBox: 'fill-box' }}
        variants={variants.rect}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function RectangleVertical(props: RectangleVerticalProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  RectangleVertical,
  RectangleVertical as RectangleVerticalIcon,
  type RectangleVerticalProps,
  type RectangleVerticalProps as RectangleVerticalIconProps,
};
