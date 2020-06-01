/* global supportedZwjEmojis, emojiSupportLevel */
/* eslint-disable prefer-const,no-labels */

import i18n from '../../i18n/en.json'
import { categories } from '../../categories'
import { DEFAULT_LOCALE, DEFAULT_DATA_SOURCE } from '../../../database/constants'
import { Database } from '../../../database/Database'
import { MIN_SEARCH_TEXT_LENGTH, DEFAULT_NUM_COLUMNS } from '../../constants'
import { requestIdleCallback } from '../../utils/requestIdleCallback'
import { calculateTextWidth } from '../../utils/calculateTextWidth'
import { hasZwj } from '../../utils/hasZwj'
import { thunk } from '../../utils/thunk'

let database
let numColumns = DEFAULT_NUM_COLUMNS
let currentEmojis = []
let locale = DEFAULT_LOCALE
let dataSource = DEFAULT_DATA_SOURCE
let currentCategory = categories[0]
let rawSearchText = ''
let searchText = ''
let rootElement
let baselineEmoji
let darkMode = 'auto'
let resolvedDarkMode // eslint-disable-line no-unused-vars

const getBaselineEmojiWidth = thunk(() => calculateTextWidth(baselineEmoji))

$: resolvedDarkMode = darkMode === 'auto' ? matchMedia('(prefers-color-scheme: dark)').matches : !!darkMode

$: database = new Database({ dataSource, locale })
$: {
  (async () => {
    if (searchText.length >= MIN_SEARCH_TEXT_LENGTH) {
      currentEmojis = await getEmojisBySearchPrefix(searchText)
    } else {
      currentEmojis = await getEmojisByGroup(currentCategory.group)
    }
  })()
}
$: {
  requestIdleCallback(() => {
    searchText = rawSearchText // defer to avoid input delays
  })
}

// Some emojis have their ligatures rendered as two or more consecutive emojis
// We want to treat these the same as unsupported emojis, so we compare their
// widths against the baseline widths and remove them as necessary
$: {
  const zwjEmojisToCheck = currentEmojis.filter(emoji => hasZwj(emoji) && !supportedZwjEmojis.has(emoji.unicode))
  if (zwjEmojisToCheck.length) {
    // render now, check their length later
    requestAnimationFrame(() => checkZwjSupport(zwjEmojisToCheck))
  } else {
    currentEmojis = currentEmojis.filter(isZwjSupported)
  }
}

function checkZwjSupport (zwjEmojisToCheck) {
  const rootNode = rootElement.getRootNode()
  for (const emoji of zwjEmojisToCheck) {
    const domNode = rootNode.getElementById(`lep-emoji-${emoji.unicode}`)
    const emojiWidth = calculateTextWidth(domNode)
    const supported = emojiWidth === getBaselineEmojiWidth()
    supportedZwjEmojis.set(emoji.unicode, supported)
    if (!supported) {
      console.log('Filtered unsupported emoji', emoji.unicode)
    }
  }
  // force update
  currentEmojis = currentEmojis // eslint-disable-line no-self-assign
}

function isZwjSupported (emoji) {
  return !hasZwj(emoji) || supportedZwjEmojis.get(emoji.unicode)
}

function filterEmojisByVersion (emojis) {
  return emojis.filter(({ version }) => version <= emojiSupportLevel)
}

async function getEmojisByGroup (group) {
  return filterEmojisByVersion(await database.getEmojiByGroup(group))
}

async function getEmojisBySearchPrefix (prefix) {
  return filterEmojisByVersion(await database.getEmojiBySearchPrefix(prefix))
}

// eslint-disable-next-line no-unused-vars
function handleCategoryClick (category) {
  // throttle to avoid input delays
  requestIdleCallback(() => {
    currentCategory = category
  })
}

export {
  locale,
  dataSource,
  i18n,
  numColumns,
  darkMode
}