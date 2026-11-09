/**
 * Renderização: geometria de enquadramento, agendamento de camadas (cortes/fades)
 * e o compositor WebGL2. Compartilhado pelo preview (M3) e pelo export (M4).
 */
export * from "./fit";
export * from "./schedule";
export { createWebGLCompositor, type Compositor, type CompositorLayer } from "./webgl-compositor";
