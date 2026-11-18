// Alguns avisos antigos foram gravados no banco com a acentuação corrompida
// (UTF-8 lido como página de código 850: "empréstimo" virou "empr├®stimo").
// Aqui desfazemos isso na hora de mostrar o texto. Texto normal passa sem mudar.
const CP850_HIGH =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐'

export function fixMojibake(text: string): string {
  if (!text || !text.includes('├')) return text
  return text.replace(/├(.)/g, (whole, c: string) => {
    const i = CP850_HIGH.indexOf(c)
    return i === -1 ? whole : String.fromCharCode(0xc0 + i)
  })
}
