import QRCode from "qrcode"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(root, "../public/qr/ppt")

const items = [
  ["sshldn-app.png", "https://sshldn.vercel.app"],
  ["sshldn-github.png", "https://github.com/ghcpuman902/ssh.ldn"],
  ["mangle-linkedin.png", "https://www.linkedin.com/in/htkuo"],
]

await mkdir(outDir, { recursive: true })

for (const [filename, url] of items) {
  const buffer = await QRCode.toBuffer(url, {
    type: "png",
    width: 1024,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#FFFFFF" },
  })
  await writeFile(path.join(outDir, filename), buffer)
  console.log(`${filename} (${buffer.length} bytes)`)
}
