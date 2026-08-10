// Complete CardMirror command database — 168 commands in 30 groups
// Labels are used in .cmcm files. IDs are internal CardMirror command identifiers.
// defaultKey uses ProseMirror format: Mod = Ctrl (Win/Linux) / Cmd (macOS)

export const COMMAND_GROUPS = [
  {
    group: 'File',
    commands: [
      { label: 'New Document', id: 'newDocument', defaultKey: 'Mod-n' },
      { label: 'Open File', id: 'openFile', defaultKey: 'Mod-o' },
      { label: 'Save', id: 'save', defaultKey: 'Mod-s' },
      { label: 'Save As…', id: 'saveAs', defaultKey: 'Mod-Shift-s' },
      { label: 'Save Send Doc', id: 'saveSendDoc', defaultKey: 'Mod-Alt-s' },
      { label: 'Save Marked Cards', id: 'saveMarkedCards', defaultKey: 'Mod-Alt-m' },
      { label: 'Toggle Autosave', id: 'toggleAutosave', defaultKey: null },
      { label: 'Go to Home Screen', id: 'goHome', defaultKey: null },
    ],
  },
  {
    group: 'Speech',
    commands: [
      { label: 'New Speech Document', id: 'newSpeechDocument', defaultKey: null },
      { label: 'Mark / Unmark Active Doc as the Speech Doc', id: 'markActiveAsSpeech', defaultKey: null },
      { label: 'Send to Speech (At Cursor)', id: 'sendToSpeechAtCursor', defaultKey: '`' },
      { label: 'Send to Speech (At End)', id: 'sendToSpeechAtEnd', defaultKey: 'Alt-`' },
      { label: 'Select Speech Document', id: 'selectSpeechDoc', defaultKey: null },
    ],
  },
  {
    group: 'Dropzone / Send and Receive Cards',
    commands: [
      { label: 'Send to Dropzone', id: 'sendToDropzone', defaultKey: 'Mod-`' },
      { label: 'Send to Starred Recipient', id: 'sendToStarred', defaultKey: null },
      { label: 'Insert Received Card (At Cursor)', id: 'insertReceivedAtCursor', defaultKey: 'Mod-p' },
      { label: 'Insert Received Card (At End)', id: 'insertReceivedAtEnd', defaultKey: 'Mod-Alt-p' },
    ],
  },
  {
    group: 'Collaboration',
    commands: [
      { label: 'Start Collaboration Session', id: 'collabStartSession', defaultKey: null },
      { label: 'Join Collaboration Session', id: 'collabJoinSession', defaultKey: null },
      { label: 'Copy Session Share Code', id: 'collabCopyShareCode', defaultKey: null },
      { label: 'Invite Starred Partner to Session', id: 'collabInviteStarred', defaultKey: null },
      { label: 'End or Leave Collaboration Session', id: 'collabEndSession', defaultKey: null },
    ],
  },
  {
    group: 'Quick Cards',
    commands: [
      { label: 'Add Quick Card', id: 'addQuickCard', defaultKey: null },
      { label: 'Manage Quick Cards', id: 'manageQuickCards', defaultKey: null },
    ],
  },
  {
    group: 'Structural Styles',
    commands: [
      { label: 'Apply Pocket Style', id: 'setPocket', defaultKey: 'F4' },
      { label: 'Apply Hat Style', id: 'setHat', defaultKey: 'F5' },
      { label: 'Apply Block Style', id: 'setBlock', defaultKey: 'F6' },
      { label: 'Apply Tag Style', id: 'setTag', defaultKey: 'F7' },
      { label: 'Apply Analytic Style', id: 'setAnalytic', defaultKey: 'Mod-F7' },
      { label: 'Apply Undertag Style', id: 'setUndertag', defaultKey: 'Mod-F8' },
    ],
  },
  {
    group: 'Numbering',
    commands: [
      { label: 'Number: Toggle Number Role', id: 'toggleNumberRole', defaultKey: 'Mod-Alt-1' },
      { label: 'Number: Toggle Substructure Role', id: 'toggleSubRole', defaultKey: 'Mod-Alt-2' },
      { label: 'Number: Toggle Start-Over-Here', id: 'toggleNumRestart', defaultKey: 'Mod-Alt-3' },
    ],
  },
  {
    group: 'Character Styles',
    commands: [
      { label: 'Apply Cite Style', id: 'applyCite', defaultKey: 'F8' },
      { label: 'Toggle Underline', id: 'applyUnderline', defaultKey: 'F9' },
      { label: 'Underline (toggle while typing)', id: 'toggleUnderlineTyping', defaultKey: 'Mod-u' },
      { label: 'Apply Emphasis Style', id: 'applyEmphasis', defaultKey: 'F10' },
      { label: 'Emphasize Acronym', id: 'emphasizeAcronym', defaultKey: 'Alt-F10' },
      { label: 'Toggle Highlight', id: 'applyHighlight', defaultKey: 'F11' },
      { label: 'Highlight Acronym', id: 'highlightAcronym', defaultKey: 'Alt-F11' },
      { label: 'Underline Acronym', id: 'underlineAcronym', defaultKey: null },
      { label: 'Toggle Background Color', id: 'applyShading', defaultKey: 'Mod-F11' },
      { label: 'Apply Font Color', id: 'applyFontColor', defaultKey: null },
    ],
  },
  {
    group: 'Inline Formatting',
    commands: [
      { label: 'Bold', id: 'toggleBold', defaultKey: 'Mod-b' },
      { label: 'Italic', id: 'toggleItalic', defaultKey: 'Mod-i' },
      { label: 'Strikethrough', id: 'toggleStrikethrough', defaultKey: null },
      { label: 'Superscript', id: 'toggleSuperscript', defaultKey: 'Mod-Shift-=' },
      { label: 'Subscript', id: 'toggleSubscript', defaultKey: 'Mod-=' },
      { label: 'Increase Font Size by 1pt', id: 'adjustFontSizeUp', defaultKey: null },
      { label: 'Decrease Font Size by 1pt', id: 'adjustFontSizeDown', defaultKey: null },
    ],
  },
  {
    group: 'Condense',
    commands: [
      { label: 'Condense', id: 'condenseDefault', defaultKey: 'F3' },
      { label: 'Condense Without Paragraph Integrity', id: 'condenseNoIntegrity', defaultKey: 'Alt-F3' },
      { label: 'Condense Without Paragraph Integrity (With Pilcrows)', id: 'condenseNoIntegrityWithPilcrows', defaultKey: 'Mod-Alt-F3' },
      { label: 'Condense With Warning', id: 'condenseWithWarning', defaultKey: null },
      { label: 'Uncondense', id: 'uncondense', defaultKey: 'Mod-Alt-Shift-F3' },
      { label: 'Toggle Case', id: 'toggleCase', defaultKey: 'Shift-F3' },
      { label: 'Toggle Paragraph Integrity', id: 'toggleParagraphIntegrity', defaultKey: null },
    ],
  },
  {
    group: 'Editing Utilities',
    commands: [
      { label: 'Paste Plain Text', id: 'pasteAsText', defaultKey: 'F2' },
      { label: 'Paste and Destructively Condense', id: 'pasteCondensed', defaultKey: null },
      { label: 'Clear', id: 'clearToNormal', defaultKey: 'F12' },
      { label: 'Shrink Card Text', id: 'shrink', defaultKey: 'Mod-8' },
      { label: 'Smart Shrink (Deeper for Unmarked Paragraphs)', id: 'smartShrink', defaultKey: 'Mod-Alt-8' },
      { label: 'Restore Card Text Size', id: 'regrow', defaultKey: 'Mod-Shift-8' },
      { label: 'Copy Previous Cite', id: 'copyPreviousCite', defaultKey: 'Alt-F8' },
      { label: 'Create Reference', id: 'createReference', defaultKey: null },
      { label: 'Extract Undertag', id: 'extractUndertag', defaultKey: null },
      { label: 'Insert Image at Cursor', id: 'insertImage', defaultKey: null },
      { label: 'Insert Footnote', id: 'insertFootnote', defaultKey: null },
      { label: 'Select Current Heading', id: 'selectCurrentHeading', defaultKey: 'Alt-a' },
      { label: 'Delete Current Heading', id: 'deleteCurrentHeading', defaultKey: null },
      { label: 'Copy Current Heading', id: 'copyCurrentHeading', defaultKey: null },
      { label: 'Move Container Up', id: 'moveContainerUp', defaultKey: 'Mod-Alt-ArrowUp' },
      { label: 'Move Container Down', id: 'moveContainerDown', defaultKey: 'Mod-Alt-ArrowDown' },
      { label: 'Flip Quote Direction', id: 'flipQuoteDirection', defaultKey: null },
      { label: 'Reading-position marker (toggle)', id: 'toggleReadingMarker', defaultKey: 'Mod-Shift-d' },
    ],
  },
  {
    group: 'Highlight Tools',
    commands: [
      { label: 'Standardize Highlighting', id: 'standardizeHighlight', defaultKey: null },
      { label: 'Standardize Background Color', id: 'standardizeShading', defaultKey: null },
      { label: 'Standardize Highlighting (with Exception)', id: 'standardizeHighlightExcept', defaultKey: null },
      { label: 'Standardize Background Color (with Exception)', id: 'standardizeShadingExcept', defaultKey: null },
      { label: 'Highlight to Background', id: 'highlightToShading', defaultKey: null },
      { label: 'Background to Highlight', id: 'shadingToHighlight', defaultKey: null },
      { label: 'Lock Highlighting', id: 'lockHighlighting', defaultKey: null },
      { label: 'Toggle Highlight Paint Mode', id: 'togglePaintbrushHighlight', defaultKey: null },
      { label: 'Toggle Background-Color Paint Mode', id: 'togglePaintbrushShading', defaultKey: null },
    ],
  },
  {
    group: 'Color Pickers & Menus',
    commands: [
      { label: 'Open Highlight Color Picker', id: 'openHighlightPicker', defaultKey: null },
      { label: 'Open Background Color Picker', id: 'openShadingPicker', defaultKey: null },
      { label: 'Open Font Color Picker', id: 'openFontColorPicker', defaultKey: null },
      { label: 'Open Font Size Picker', id: 'openFontSizePicker', defaultKey: null },
      { label: 'Open Doc Tools Menu', id: 'openDocToolsMenu', defaultKey: null },
      { label: 'Open Card Tools Menu', id: 'openCardToolsMenu', defaultKey: null },
      { label: 'Open Table Menu', id: 'openTableMenu', defaultKey: null },
    ],
  },
  {
    group: 'Find',
    commands: [
      { label: 'Find', id: 'openFind', defaultKey: 'Mod-f' },
      { label: 'Find and Replace', id: 'openFindReplace', defaultKey: 'Mod-h' },
      { label: 'Find Without Category Grouping', id: 'openFindByProximity', defaultKey: 'Alt-f' },
    ],
  },
  {
    group: 'Search',
    commands: [
      { label: 'Search Everything', id: 'openQuickCardSearch', defaultKey: 'Mod-Shift-Space' },
    ],
  },
  {
    group: 'View',
    commands: [
      { label: 'Toggle Read Mode', id: 'toggleReadMode', defaultKey: null },
      { label: 'Show / Hide Navigation Pane', id: 'toggleNavPane', defaultKey: null },
      { label: 'Word Count Selection', id: 'wordCountSelection', defaultKey: null },
      { label: 'Open Settings', id: 'openSettings', defaultKey: null },
      { label: 'Open Keyboard Shortcuts', id: 'openShortcutsReference', defaultKey: null },
      { label: 'Cycle Theme (Light → Dark → System)', id: 'cycleTheme', defaultKey: null },
      { label: 'Minimize Window', id: 'minimizeWindow', defaultKey: 'Mod-m' },
    ],
  },
  {
    group: 'Timer',
    commands: [
      { label: 'Timer: Show / Hide Panel', id: 'timerToggleVisible', defaultKey: null },
      { label: 'Timer: Start / Pause', id: 'timerStartPause', defaultKey: null },
      { label: 'Timer: Start Speech Preset 1', id: 'timerPreset1', defaultKey: null },
      { label: 'Timer: Start Speech Preset 2', id: 'timerPreset2', defaultKey: null },
      { label: 'Timer: Start Speech Preset 3', id: 'timerPreset3', defaultKey: null },
      { label: 'Timer: Start Aff Prep', id: 'timerStartAffPrep', defaultKey: null },
      { label: 'Timer: Start Neg Prep', id: 'timerStartNegPrep', defaultKey: null },
      { label: 'Timer: Reset', id: 'timerReset', defaultKey: null },
      { label: 'Cycle Timer Preset (College → High School → Pomodoro)', id: 'cycleTimerPreset', defaultKey: null },
    ],
  },
  {
    group: 'Zoom & Scale',
    commands: [
      { label: 'Zoom In', id: 'zoomIn', defaultKey: 'Mod-=' },
      { label: 'Zoom Out', id: 'zoomOut', defaultKey: 'Mod--' },
      { label: 'Reset Zoom to 100%', id: 'zoomReset', defaultKey: null },
      { label: 'Chrome Scale Up', id: 'chromeScaleUp', defaultKey: 'Mod-Alt-=' },
      { label: 'Chrome Scale Down', id: 'chromeScaleDown', defaultKey: 'Mod-Alt--' },
      { label: 'Reset Chrome Scale to 100%', id: 'chromeScaleReset', defaultKey: 'Mod-Alt-0' },
    ],
  },
  {
    group: 'Diagnostics',
    commands: [
      { label: 'Open Developer Console', id: 'openDevConsole', defaultKey: null },
    ],
  },
  {
    group: 'Comments',
    commands: [
      { label: 'Show / Hide Comments', id: 'toggleCommentsVisible', defaultKey: null },
      { label: 'Add Comment to Selection', id: 'addCommentToSelection', defaultKey: null },
      { label: 'Add Note to Selection', id: 'addNoteToSelection', defaultKey: 'Mod-Shift-n' },
    ],
  },
  {
    group: 'Multi-pane Workspace',
    commands: [
      { label: 'Focus Slot 1', id: 'focusSlot1', defaultKey: 'Mod-1' },
      { label: 'Focus Slot 2', id: 'focusSlot2', defaultKey: 'Mod-2' },
      { label: 'Focus Slot 3', id: 'focusSlot3', defaultKey: 'Mod-3' },
      { label: 'Send Doc to Slot 1', id: 'sendDocToSlot1', defaultKey: 'Mod-Shift-1' },
      { label: 'Send Doc to Slot 2', id: 'sendDocToSlot2', defaultKey: 'Mod-Shift-2' },
      { label: 'Send Doc to Slot 3', id: 'sendDocToSlot3', defaultKey: 'Mod-Shift-3' },
      { label: 'Toggle Slot Expand / Restore', id: 'toggleSlotExpand', defaultKey: 'Mod-Shift-f' },
      { label: 'Next Document in Slot', id: 'cycleDocNext', defaultKey: null },
      { label: 'Previous Document in Slot', id: 'cycleDocPrev', defaultKey: null },
      { label: 'Close Doc or Window', id: 'closeDocOrWindow', defaultKey: 'Mod-w' },
    ],
  },
  {
    group: 'AI',
    commands: [
      { label: 'Ask AI About Selection', id: 'aiAskAboutSelection', defaultKey: 'Mod-Shift-q' },
      { label: 'Format Cite From Selection (AI)', id: 'aiCreateCite', defaultKey: 'Mod-Shift-x' },
      { label: 'Reformat Every Cite in Document (AI)', id: 'reformatAllCites', defaultKey: null },
      { label: 'Translate Selection to Clipboard (AI)', id: 'translate', defaultKey: 'Mod-Shift-t' },
      { label: 'Repair OCR/PDF Text (AI)', id: 'repairText', defaultKey: 'Mod-Shift-r' },
      { label: 'Repair Formatting (AI)', id: 'repairFormatting', defaultKey: 'Mod-Alt-r' },
    ],
  },
  {
    group: 'Flow',
    commands: [
      { label: 'Send to Flow (one cell per line)', id: 'sendToFlowColumn', defaultKey: null },
      { label: 'Send to Flow (single cell)', id: 'sendToFlowCell', defaultKey: null },
      { label: 'Send Headings to Flow (one cell per line)', id: 'sendHeadingsToFlowColumn', defaultKey: null },
      { label: 'Send Headings to Flow (single cell)', id: 'sendHeadingsToFlowCell', defaultKey: null },
      { label: 'Pull Selection from Flow', id: 'pullFromFlow', defaultKey: null },
      { label: 'Create New Flow', id: 'createFlow', defaultKey: null },
      { label: 'Start Flow Connection', id: 'startFlowHost', defaultKey: null },
    ],
  },
  {
    group: 'Voice',
    commands: [
      { label: 'Toggle voice control', id: 'toggleVoice', defaultKey: 'Mod-Shift-V' },
    ],
  },
  {
    group: 'Card Cutter',
    commands: [
      { label: 'Cut card with AI…', id: 'openCardCutter', defaultKey: 'Mod-Alt-c' },
      { label: 'Use Selection as Cutter Context', id: 'addCutterContext', defaultKey: null },
      { label: 'Edit File Cutting Guidance', id: 'openCutterGuidance', defaultKey: null },
    ],
  },
  {
    group: 'Learn',
    commands: [
      { label: 'Create Flashcard From Selection', id: 'createFlashcard', defaultKey: null },
      { label: 'Manage Flashcards', id: 'manageFlashcards', defaultKey: null },
    ],
  },
  {
    group: 'Select',
    commands: [
      { label: 'Select Similar Formatting', id: 'selectSimilar', defaultKey: null },
    ],
  },
  {
    group: 'Cleanup',
    commands: [
      { label: 'Convert Analytics to Tags', id: 'convertAnalyticsToTags', defaultKey: null },
      { label: 'Convert Cited Analytics to Tags', id: 'convertCitedAnalyticsToTags', defaultKey: null },
      { label: 'Fix Formatting Gaps', id: 'fixFormattingGaps', defaultKey: null },
      { label: 'Repair Paragraph Integrity', id: 'repairParagraphIntegrity', defaultKey: null },
      { label: 'Remove Hyperlinks', id: 'removeHyperlinks', defaultKey: null },
    ],
  },
  {
    group: 'Table',
    commands: [
      { label: 'Insert Table', id: 'insertTable', defaultKey: null },
      { label: 'Insert Row Above', id: 'addRowBefore', defaultKey: null },
      { label: 'Insert Row Below', id: 'addRowAfter', defaultKey: null },
      { label: 'Insert Column Left', id: 'addColumnBefore', defaultKey: null },
      { label: 'Insert Column Right', id: 'addColumnAfter', defaultKey: null },
      { label: 'Delete Row', id: 'deleteTableRow', defaultKey: null },
      { label: 'Delete Column', id: 'deleteTableColumn', defaultKey: null },
      { label: 'Merge Cells', id: 'mergeTableCells', defaultKey: null },
      { label: 'Split Cell', id: 'splitTableCell', defaultKey: null },
      { label: 'Delete Table', id: 'deleteTable', defaultKey: null },
    ],
  },
  {
    group: 'Live Views & Linked Copies',
    commands: [
      { label: 'Insert Linked Copy from a File', id: 'insertLiveZone', defaultKey: null },
      { label: 'Insert Live View', id: 'insertSelfLiveZone', defaultKey: null },
      { label: 'Insert Linked Copy from This Document', id: 'insertInDocCopy', defaultKey: null },
      { label: 'Refresh Linked Copy', id: 'refreshLiveZone', defaultKey: null },
      { label: 'Refresh All Linked Copies', id: 'refreshAllLiveZones', defaultKey: null },
      { label: 'Check Linked Copy Sources for Updates', id: 'checkLiveZoneSources', defaultKey: null },
      { label: 'Unlink Copy', id: 'detachLiveZone', defaultKey: null },
    ],
  },
];

// Build flat lookup maps
export const ALL_COMMANDS = [];
export const LABEL_TO_COMMAND = {};
export const ID_TO_COMMAND = {};

for (const group of COMMAND_GROUPS) {
  for (const cmd of group.commands) {
    const entry = { ...cmd, group: group.group };
    ALL_COMMANDS.push(entry);
    LABEL_TO_COMMAND[cmd.label.toLowerCase()] = entry;
    ID_TO_COMMAND[cmd.id] = entry;
  }
}
