/**
 * Renderização: geometria de enquadramento, agendamento de camadas (cortes/fades)
 * e o compositor WebGL2. Compartilhado pelo preview (M3) e pelo export (M4).
 */
export * from "./crop";
export * from "./effects";
export * from "./fit";
export * from "./schedule";
export { createWebGLCompositor, type Compositor, type CompositorLayer, type FrameEffects } from "./webgl-compositor";
export * from "./filters";
export * from "./motion";
