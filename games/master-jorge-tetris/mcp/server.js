#!/usr/bin/env node

/**
 * MCP Server for Master Jorge: Tetris Wars
 *
 * Tools:
 *   tetris.health            - Health check with uptime and version
 *   tetris.leaderboard       - Read / return leaderboard
 *   tetris.stats             - Game statistics
 *   tetris.config            - Game configuration
 *   tetris.reset_leaderboard - Reset the leaderboard
 *
 * Transport: stdio
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VERSION = "1.0.0";
const SERVER_NAME = "master-jorge-tetris";
const LEADERBOARD_PATH = path.join(__dirname, "leaderboard.json");
const STATS_PATH = path.join(__dirname, "stats.json");
const START_TIME = Date.now();

const DEFAULT_LEADERBOARD = {
  entries: [],
  updatedAt: new Date().toISOString(),
};

const DEFAULT_STATS = {
  totalGamesPlayed: 0,
  totalLinesCleared: 0,
  totalScore: 0,
  totalForceBlasts: 0,
  highestScore: 0,
  highestLines: 0,
  highestLevel: 0,
  bestRank: "Padawan",
  modeBreakdown: { standard: 0, empire: 0 },
  updatedAt: new Date().toISOString(),
};

const GAME_CONFIG = {
  modes: {
    standard: {
      label: "Alliance Standard",
      description: "Classic speed curve. Precision wins this battle.",
      speedMultiplier: 1.0,
    },
    empire: {
      label: "Empire Assault",
      description: "Faster gravity (0.82x interval). No mercy.",
      speedMultiplier: 0.82,
    },
  },
  scoring: {
    single: 100,
    double: 300,
    triple: 500,
    tetris: 800,
    softDropPerRow: 1,
    hardDropPerRow: 2,
    comboMultiplier: "combo * 50 * level",
    backToBackBonus: "50% of base (Tetris only)",
  },
  gravity: {
    baseInterval: 900,
    levelReduction: 65,
    minimumInterval: 90,
    empireMinimum: 70,
  },
  ranks: [
    { name: "Padawan", scoreThreshold: 0, lineThreshold: 0 },
    { name: "Pilot", scoreThreshold: 1700, lineThreshold: 14 },
    { name: "Squad Lead", scoreThreshold: 4200, lineThreshold: 30 },
    { name: "Commander", scoreThreshold: 8000, lineThreshold: 60 },
    { name: "Jedi Knight", scoreThreshold: 13000, lineThreshold: 95 },
    { name: "Grand Master", scoreThreshold: 22000, lineThreshold: 160 },
  ],
  forceBlast: {
    maxMeter: 100,
    chargeFromSoftDrop: 0.5,
    chargeFromHardDrop: "distance * 0.9",
    chargeFromLineClear: "12 + count * 16 + (tetris ? 10 : 0) + combo * 4",
    effect: "Clears the most-filled row on the board",
    scoreBonus: "220 + level * 30",
  },
  board: { cols: 10, rows: 20 },
  queueSize: 5,
  pieceTypes: ["I", "J", "L", "O", "S", "T", "Z"],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJson(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch {
    /* corrupted file — use fallback */
  }
  return JSON.parse(JSON.stringify(fallback));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: SERVER_NAME,
  version: VERSION,
});

// --- tetris.health ---
server.tool(
  "tetris.health",
  "Health check — returns server uptime, version, and status",
  {},
  async () => {
    const uptimeMs = Date.now() - START_TIME;
    const result = {
      status: "ok",
      server: SERVER_NAME,
      version: VERSION,
      uptime: formatUptime(uptimeMs),
      uptimeMs,
      leaderboardExists: fs.existsSync(LEADERBOARD_PATH),
      statsExists: fs.existsSync(STATS_PATH),
      timestamp: new Date().toISOString(),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// --- tetris.leaderboard ---
server.tool(
  "tetris.leaderboard",
  "Retrieve the current leaderboard (top scores)",
  {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Maximum entries to return (default 10)"),
  },
  async ({ limit }) => {
    const lb = readJson(LEADERBOARD_PATH, DEFAULT_LEADERBOARD);
    const cap = limit ?? 10;
    const sorted = lb.entries.sort((a, b) => b.score - a.score).slice(0, cap);

    const result = {
      entries: sorted,
      total: lb.entries.length,
      returned: sorted.length,
      updatedAt: lb.updatedAt,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// --- tetris.stats ---
server.tool(
  "tetris.stats",
  "Game statistics — total games, lines, scores, force blasts, etc.",
  {},
  async () => {
    const stats = readJson(STATS_PATH, DEFAULT_STATS);
    return {
      content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
    };
  },
);

// --- tetris.config ---
server.tool(
  "tetris.config",
  "Game configuration — modes, scoring rules, ranks, board dimensions",
  {},
  async () => {
    return {
      content: [{ type: "text", text: JSON.stringify(GAME_CONFIG, null, 2) }],
    };
  },
);

// --- tetris.reset_leaderboard ---
server.tool(
  "tetris.reset_leaderboard",
  "Reset the leaderboard to empty",
  {
    confirm: z.boolean().describe("Must be true to execute the reset"),
  },
  async ({ confirm }) => {
    if (!confirm) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              reset: false,
              reason: "confirm must be true",
            }),
          },
        ],
      };
    }

    const fresh = {
      entries: [],
      updatedAt: new Date().toISOString(),
    };
    writeJson(LEADERBOARD_PATH, fresh);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            reset: true,
            message: "Leaderboard has been reset.",
            updatedAt: fresh.updatedAt,
          }),
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is now listening on stdio
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
