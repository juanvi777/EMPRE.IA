export function createAssistantReply(message: string): string {
  const normalized = message.toLocaleLowerCase('es-CO');
  if (normalized.includes('cliente')) return 'Puedo revisar clientes, buscar pendientes y preparar acciones dentro de los permisos de tu empresa.';
  if (normalized.includes('tarea')) return 'Puedo revisar las tareas pendientes, priorizarlas y, cuando exista una herramienta autorizada, ejecutar acciones.';
  if (normalized.includes('automat')) return 'Puedo revisar tus automatizaciones, indicar su estado y preparar cambios. Las acciones sensibles requieren autorización.';
  if (normalized.includes('problema') || normalized.includes('error')) return 'Puedo comenzar un diagnóstico con las herramientas que tu empresa haya conectado y explicar qué detecté antes de ejecutar cambios.';
  return 'Entendido. Soy EMPRE.IA. En este núcleo local puedo consultar el contexto de tu empresa, trabajar con tus módulos y registrar las acciones realizadas.';
}
