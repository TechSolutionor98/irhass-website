import { execSync } from "child_process"
import path from "path"

/**
 * Get the PID and process name listening on a specific TCP port (Windows & Unix).
 */
export function getProcessOnPort(port) {
  const isWindows = process.platform === "win32"

  if (isWindows) {
    try {
      const output = execSync("netstat -ano -p tcp", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      })
      const lines = output.split("\n")
      const portRegex = new RegExp(`[:.]${port}\\s+`)

      for (const line of lines) {
        if (portRegex.test(line) && line.includes("LISTENING")) {
          const parts = line.trim().split(/\s+/)
          const pid = Number.parseInt(parts[parts.length - 1], 10)
          if (!Number.isNaN(pid) && pid > 0) {
            const info = getWindowsProcessInfo(pid)
            return { pid, ...info }
          }
        }
      }
    } catch {
      // Ignore netstat errors
    }
  } else {
    try {
      const output = execSync(`lsof -i :${port} -sTCP:LISTEN -t -P`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      })
      const pid = Number.parseInt(output.trim().split("\n")[0], 10)
      if (!Number.isNaN(pid) && pid > 0) {
        return { pid, name: "node", isOurBackend: true }
      }
    } catch {
      // Ignore lsof errors
    }
  }

  return null
}

/**
 * Get details about a Windows process by PID.
 */
function getWindowsProcessInfo(pid) {
  try {
    const cmd = `wmic process where ProcessId=${pid} get CommandLine,Name /value`
    const output = execSync(cmd, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })

    let name = ""
    let commandLine = ""

    for (const line of output.split("\n")) {
      const trimmed = line.trim()
      if (trimmed.startsWith("Name=")) {
        name = trimmed.slice(5).trim()
      } else if (trimmed.startsWith("CommandLine=")) {
        commandLine = trimmed.slice(12).trim()
      }
    }

    const isNode = name.toLowerCase() === "node.exe" || name.toLowerCase() === "node"
    const isOurBackend =
      isNode &&
      (commandLine.includes("server.js") ||
        commandLine.includes("nodemon") ||
        commandLine.includes("irhaas"))

    return { name, commandLine, isOurBackend }
  } catch {
    return { name: "unknown", commandLine: "", isOurBackend: false }
  }
}

/**
 * Ensures the specified port is available.
 * If occupied by an orphaned instance of this backend in development mode,
 * terminates it to allow clean startup.
 * If occupied by an unrelated process, logs an error and exits cleanly without crashing.
 */
export async function ensurePortAvailable(port, { isDev = true } = {}) {
  const currentPid = process.pid
  const listener = getProcessOnPort(port)

  if (!listener) {
    return true // Port is free
  }

  if (listener.pid === currentPid) {
    return true // Already owned by current process
  }

  console.log(`\n🔍 Port ${port} check: Found process ${listener.name} (PID: ${listener.pid})`)

  if (isDev && listener.isOurBackend) {
    console.log(
      `⚠️ Detected previous backend instance (PID: ${listener.pid}) occupying port ${port}. Freeing port...`
    )
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /F /PID ${listener.pid}`, { stdio: "ignore" })
      } else {
        process.kill(listener.pid, "SIGKILL")
      }

      // Wait up to 2 seconds for port to clear
      const startTime = Date.now()
      while (Date.now() - startTime < 2000) {
        const check = getProcessOnPort(port)
        if (!check || check.pid === currentPid) {
          console.log(`✅ Port ${port} has been successfully cleared.`)
          return true
        }
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    } catch (err) {
      console.warn(`⚠️ Could not terminate process ${listener.pid}:`, err.message)
    }
  } else {
    console.error(
      `❌ Port ${port} is occupied by an unrelated process: ${listener.name} (PID: ${listener.pid}).`
    )
    console.error(`CommandLine: ${listener.commandLine || "N/A"}`)
    console.error(`Please stop that process or configure a different PORT in .env.`)
    throw new Error(`Port ${port} is already in use by PID ${listener.pid} (${listener.name})`)
  }

  return true
}

/**
 * Setup graceful shutdown handlers for the HTTP server.
 */
export function setupGracefulShutdown(server) {
  let isShuttingDown = false

  const shutdown = (signal) => {
    if (isShuttingDown) return
    isShuttingDown = true

    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`)

    if (server && server.listening) {
      server.close((err) => {
        if (err) {
          console.error("Error closing HTTP server:", err)
        } else {
          console.log("✅ HTTP server closed. Port released.")
        }
        process.exit(0)
      })

      // Force close after 3 seconds if connections persist
      setTimeout(() => {
        console.warn("⚠️ Forcefully terminating after shutdown timeout.")
        process.exit(0)
      }, 3000).unref()
    } else {
      process.exit(0)
    }
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))

  // Nodemon restart signal on POSIX
  process.once("SIGUSR2", () => {
    if (server && server.listening) {
      server.close(() => {
        process.kill(process.pid, "SIGUSR2")
      })
    } else {
      process.kill(process.pid, "SIGUSR2")
    }
  })
}

