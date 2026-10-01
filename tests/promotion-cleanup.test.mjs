/*
 * Pixel Fortress - A 2D real-time strategy game
 * Copyright (C) 2026 Dorian Bayart
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Focused checks for the self-hosted promotion cleanup.
 * Verifies the published entry (play.html) and its locales/service worker
 * carry no donation link while credits, license and source links stay intact.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8')

let failures = 0
function check(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`)
  } else {
    failures++
    console.error(`✗ ${message}`)
  }
}

const playHtml = read('play.html')

check(
  !/ko-fi|kofi|supportkofi/i.test(playHtml),
  'play.html contains no Ko-fi/donation reference'
)
check(
  (playHtml.match(/class="link-container"/g) || []).length === 2,
  'play.html About modal keeps exactly two link containers (repository + developer profile)'
)
check(
  playHtml.includes('https://github.com/dorianbayart/pixel-fortress'),
  'play.html keeps the game repository link'
)
check(
  playHtml.includes('https://github.com/dorianbayart'),
  'play.html keeps the developer profile link'
)
check(
  playHtml.includes('data-i18n="about.credits"') &&
    playHtml.includes('data-i18n="about.license"'),
  'play.html keeps credits and license sections'
)
check(
  playHtml.includes('https://www.gnu.org/licenses/gpl-3.0.html'),
  'play.html keeps the GPL license link'
)

const playHosts = [...playHtml.matchAll(/href="(https:\/\/[^"]+)"/g)]
  .map((match) => new URL(match[1]).hostname)
const allowedPlayHosts = new Set([
  'github.com',
  'www.gnu.org',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'dorianbayart.github.io',
])
const unexpectedPlayHosts = playHosts.filter((host) => !allowedPlayHosts.has(host))
check(
  unexpectedPlayHosts.length === 0,
  `play.html external links stay on allow-listed hosts (unexpected: ${unexpectedPlayHosts.join(', ') || 'none'})`
)

for (const locale of ['en', 'de', 'es', 'fr']) {
  const raw = read(`locales/${locale}.json`)
  let parsed = null
  let parseError = null
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    parseError = error
  }
  check(parseError === null, `locales/${locale}.json parses as JSON`)
  if (parsed) {
    check(
      !('supportKofi' in (parsed.about || {})),
      `locales/${locale}.json drops the unused about.supportKofi key`
    )
  }
  check(
    !/ko-fi/i.test(raw),
    `locales/${locale}.json contains no Ko-fi text`
  )
}

const serviceWorker = read('sw.js')
check(
  !serviceWorker.includes("CACHE_NAME = 'PixelFortress_Cache_0.0.4'"),
  'sw.js cache name is bumped so installed clients drop the old cached entry'
)
check(
  serviceWorker.includes("const CACHE_NAME = 'PixelFortress_Cache_0.0.4.1'"),
  'sw.js cache name matches the expected bump value'
)
check(
  !serviceWorker.includes('assets/icons/kofi_symbol.png'),
  'sw.js no longer pre-caches the Ko-fi icon'
)
check(
  serviceWorker.includes("'play.html'"),
  'sw.js still pre-caches the published entry play.html'
)

const analyticsSource = read('js/analytics.mjs')
check(
  /enabled:\s*false/.test(analyticsSource),
  'js/analytics.mjs keeps telemetry disabled for the self-hosted build'
)
check(
  !/umami\.is|googletagmanager|google-analytics/.test(analyticsSource),
  'js/analytics.mjs references no analytics host'
)
check(
  read('js/index.mjs').includes("import { initAnalytics } from 'analytics'"),
  'js/index.mjs keeps the initAnalytics API wiring'
)

if (failures > 0) {
  console.error(`\n✗ ${failures} promotion cleanup check(s) failed`)
  process.exitCode = 1
} else {
  console.log('\n✓ All promotion cleanup checks passed')
}
