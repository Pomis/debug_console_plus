---
name: User Research Findings
overview: Comprehensive user research identifying real people complaining about the exact problems that Debug Console+ solves, sourced from GitHub issues, Stack Overflow, and community discussions.
todos: []
isProject: false
---

# User Research: People Complaining About Problems Debug Console+ Solves

## Summary of Findings

There is **significant, documented frustration** across GitHub, Stack Overflow, and developer communities about the limitations of VS Code's built-in debug console. The complaints map directly to features Debug Console+ provides. Below is a breakdown organized by pain point.

---

## Pain Point 1: No Log Level Filtering (Error/Warn/Info/Debug)

**Your feature:** One-click level toggle buttons

**Key evidence:**

- **[microsoft/vscode#105864](https://github.com/microsoft/vscode/issues/105864)** - "Support filtering debug console items by level" -- Filed by a VS Code team member (roblourens) himself, acknowledging the need. Got 7 thumbs-up. Marked **out-of-scope** and closed because the Debug Adapter Protocol (DAP) doesn't support log levels natively. The VS Code team has **officially declined to build this**.
  - Comment from **@ljurow** (Feb 2025): *"I find this to be a pretty valuable feature when I use it in the chrome debugger and I'd love to see it in VS Code's Debug Console. I can then choose to ONLY look at my errors, warnings, etc. The debug version of my javascript application outputs lots of things (as "info" and "verbose"), but when something goes wrong, the first thing I want to see are just the errors."*
- **[StackOverflow: "How to set log level of debug console in Visual Studio Code"](https://stackoverflow.com/questions/62565141)** - 3 upvotes, no real solution exists natively.

**Takeaway:** This is a gap the VS Code team has acknowledged but **explicitly said they won't fix**. Debug Console+ fills it with smart parsing.

---

## Pain Point 2: Noisy/Cluttered Debug Console Output

**Your features:** Smart parsing, normalization, tag highlighting, Android logcat support, Flutter prefix cleaning

**Key evidence:**

- **[microsoft/vscode#93750](https://github.com/microsoft/vscode/issues/93750)** - "Debug Console NEEDS a filter" -- **18 thumbs-up**. A passionate Flutter developer (JCKodel) wrote: *"There is a lot of extensions that overwhelm the debug console (including C# and Flutter extensions). The Flutter extension team blames VSCode for not having the proper API's to allow filtering."* He became so frustrated he wrote: *"FIND is not the same as FILTER. FILTER is when you want to EXCLUDE the filtered term. The problem is the spam nature of this dialog."*
  - **@arhelmus** commented: *"Its actually really hard to get use of debug console in real world application which has lots of processes in. Basically, I have a wall of logs which produces faster than I can read and there is no reliable way for me to configure what I wanna see, searching is nice but it didn't really helps much as: I want to see only what I need, not search for what I need in tons of text."*
  - **@Elias-Graf**: *"my application has different services and each one has its 'log tag'. If I'm debugging a certain service, I don't want to be spammed by any other logs."* -- Gave a regex example using `[test]` tags, which is exactly what Debug Console+ parses.
- **[microsoft/vscode#99921](https://github.com/microsoft/vscode/issues/99921)** - Literally titled **"Debug Console is useless"** -- Same frustrated developer describing broken selection, copy, and lack of filtering. *"I urge you to refactory this important panel from scratch."*
- **[StackOverflow: "Flutter - how to filter debug console in vscode"](https://stackoverflow.com/questions/60259610)** - **25 upvotes, 13k views**. Flutter devs overwhelmed by `EGL_emulation`, `DynamiteModule`, and `Accessing hidden method` noise. Multiple commenters: *"Same here. After update to the latest version of flutter, the debug console becomes overwhelmed"*, *"Also looking for a fix"*, *"So brutal."*
- **[microsoft/vscode#194080](https://github.com/microsoft/vscode/issues/194080)** - "Crazy tons of Just My Code log text in debug output windows"
- **[microsoft/vscode#197803](https://github.com/microsoft/vscode/issues/197803)** - Requesting log type indicators, timestamps, alternating row colors, better row separation. VS Code team response from roblourens: *"the debug console is not pretty, I will admit that."*
- **[flutter/flutter#50808](https://github.com/flutter/flutter/issues/50808)** - Feature request to add a flag to `flutter run` to filter output, because the noise is unbearable.

**Takeaway:** Flutter and Android developers are the most vocal group suffering from this. Debug Console+'s smart parsing of logcat prefixes (`V/D/I/W/E/F`) and Flutter prefix cleaning directly addresses their #1 complaint.

---

## Pain Point 3: No Timestamps in Debug Console

**Your feature:** Toggleable timestamps (absolute, relative, auto-hide on narrow panels)

**Key evidence:**

- **[microsoft/vscode#61298](https://github.com/microsoft/vscode/issues/61298)** - "Show Timestamp while Debugging" -- **44 thumbs-up, 4 hearts, 2 rockets, open since October 2018**. Still open after **7+ years**. Users keep bumping it:
  - **@burekas7** (Dec 2022): *"2022. Any update on this issue?"*
  - **@josephgruber** (Feb 2023): *"Looking for this capability as well"*
  - **@ezamagni** (May 2023): *"That would be indeed VERY useful"*
  - **@JerryNorbury** (Jul 2023): *"Anything?"*
  - **@yuis-ice** (Dec 2024): *"Bump. I don't understand why it doesn't get implemented in the both aspects its usefulness and simplicity."*
  - **@tperraut** (Jul 2025): *"Seems this needs a little bump!"*

**Takeaway:** 44+ upvotes, 7 years open, constant bumping. This is one of the most-wanted debug console features and VS Code still hasn't shipped it. Debug Console+ solves it today.

---

## Pain Point 4: Can't Copy Logs Properly

**Your feature:** Copy all filtered logs, "Copy up to here", "Copy from here"

**Key evidence:**

- **[microsoft/vscode#28094](https://github.com/microsoft/vscode/issues/28094)** - "Copy all in debug console as plain text" -- 6 thumbs-up. Opened in **2017**, closed in 2021 with "No action planned."
  - **@robross0606**: *"Copying results in truncated versions of large objects or arrays... It is infuriating."*
  - **@chillmanstr8**: *"I can't seem to copy anything... I hate resorting to screenshots."*
- **[microsoft/vscode#187784](https://github.com/microsoft/vscode/issues/187784)** - "No way to copy full value from debugger console"
- **[microsoft/vscode#2163](https://github.com/microsoft/vscode/issues/2163)** - "Multi page selection in debug console" -- Opened in **2016**. Can't select across pages because the console is virtualized.
- **[StackOverflow: "Copy debug console to the clipboard"](https://stackoverflow.com/questions/37153675)** - Highly viewed question about copying woes.

**Takeaway:** Copying from the debug console has been broken/limited for nearly a decade. Debug Console+'s copy filtered, copy-up-to-here, and copy-from-here features directly address this.

---

## Pain Point 5: Auto-Scroll Behavior is Broken

**Your feature:** Smart auto-scroll (follows new logs, pauses when you scroll up)

**Key evidence:**

- **[microsoft/vscode#32632](https://github.com/microsoft/vscode/issues/32632)** - "Debug console: be able to disable automatic scrolling to end" -- Opened Aug 2017. Users want control over auto-scroll.
- **[microsoft/vscode#10486](https://github.com/microsoft/vscode/issues/10486)** - "Feature request: 'smart' scroll-lock in DEBUG console" -- Requesting exactly the behavior Debug Console+ implements: auto-scroll disabled when user scrolls up, re-enabled at bottom.
- **[microsoft/vscode#77837](https://github.com/microsoft/vscode/issues/77837)** - "Debug console stops autoscrolling when a line wraps around"
- **[StackOverflow: "VSCode debug console does not stay scrolled to the bottom"](https://stackoverflow.com/questions/69562861)** - Flutter developers especially affected.

**Takeaway:** The exact "smart scroll-lock" behavior people have been requesting is what Debug Console+ ships with.

---

## Pain Point 6: Search is Filter-Only, No Regex, No Combined Logic

**Your feature:** Text/regex search with AND/OR logic, search highlighting

**Key evidence:**

- **[microsoft/vscode#177579](https://github.com/microsoft/vscode/issues/177579)** - "Debug Console Search" -- User wanted search to highlight matching rows rather than filter them out entirely, because filtering loses context.
- **[microsoft/vscode#93512](https://github.com/microsoft/vscode/issues/93512)** - Requested regex filter support for debug console.
- **[microsoft/vscode#142922](https://github.com/microsoft/vscode/issues/142922)** - "Debug Console Filter is a bit confusing" -- Users confused about when filter is active, no clear way to reset, accidentally clearing entire console.

**Takeaway:** VS Code's basic text filter (added in 2020) is widely considered insufficient. No regex, no AND/OR logic, no highlighting. Debug Console+ provides all three.

---

## Pain Point 7: AI Can't Access Debug Logs

**Your feature:** Built-in MCP server for AI agent log queries

**Key evidence:**

- **[Cursor Blog: "More Problems" (2024)](https://cursor.com/en/blog/problems-2024)** - Cursor identifies optimal context management (leveraging logs, production data, documentation) as an ongoing research challenge.
- **[BillPrin article on MCP + browser console](https://www.billprin.com/articles/mcp-cursor-browser-errors)** - Describes the pain point of AI agents being "blind to runtime errors" and how MCP bridges the gap. *"This prevents AI agents from getting stuck on runtime errors they can't see, reducing the need to manually copy-paste errors back into the chat."*
- **[microsoft/DebugMCP](https://github.com/microsoft/DebugMCP)** - Microsoft themselves built an MCP server for debugging, validating that AI + debug logs is a real need.
- **[claude-debugs-for-you](https://github.com/jasonjmcghee/claude-debugs-for-you)** - An MCP extension enabling AI to debug interactively, showing community demand.
- **[Cursor Debug Mode](https://cursor.com/blog/debug-mode)** - Cursor built Debug Mode specifically because AI agents struggle with complex bugs when they lack runtime context.

**Takeaway:** The industry is actively trying to solve "AI can't see my debug logs." Debug Console+'s MCP server is positioned at exactly the right intersection.

---

## Pain Point 8: Performance with Large Log Volumes

**Your feature:** Virtual scrolling, configurable max logs (10,000 default), incremental filtering

**Key evidence:**

- **[microsoft/vscode#249922](https://github.com/microsoft/vscode/issues/249922)** - "Evaluating expression of large objects from the debug console is extremely slow"
- **[microsoft/vscode-js-debug#1433](https://github.com/microsoft/vscode-js-debug/issues/1433)** - JavaScript debug console slowness with large bundled code.
- **[microsoft/vscode#94937](https://github.com/microsoft/vscode/issues/94937)** - Feature request to truncate and handle large values better.

---

---

# SEGMENT 1: Flutter/Dart Developers -- Deep Dive

## Their Pain Points (mapped to Debug Console+ features)

### A. Logcat Noise Overload (Level filtering + Normalization + Smart parsing)

Flutter devs on Android get crushed by system-level logcat spam: `D/EGL_emulation`, `D/eglCodecCommon`, `D/BufferQueueProducer`, `I/DynamiteModule`, `W/...Accessing hidden method`, `D/OpenSSLLib`, `D/NetworkSecurityConfig`, and hundreds of `cancelBuffer` lines per second. This is their #1 pain point.

**Acquisition links:**

1. **[flutter/flutter#50808](https://github.com/flutter/flutter/issues/50808)** - "Feature request: Add a flag to flutter run to filter output" -- **17 thumbs-up**, **27 comments**, STILL OPEN. Key commenters to reach:
  - [@GanongLS](https://github.com/GanongLS) (Feb 2021): *"Hope this feature release soon, it's so annoying to watch my log so messy."* (7 upvotes on comment)
  - [@dreamflasher](https://github.com/dreamflasher) (Sep 2021): *"spammy debug messages make the log output unusable"* (4 upvotes)
  - [@william-levi](https://github.com/william-levi) (Jun 2021): *"any update on this?"* (5 eyes reactions)
  - [@s-talkanova-fraiss](https://github.com/s-talkanova-fraiss) (Aug 2021): *"Any update on when this is going to get implemented?"*
  - [@peterkapena](https://github.com/peterkapena) (Jun 2020): pasted wall of `setVertexArrayObject` spam, asked *"Hot to remove these?"*
  - [@Nukesor](https://github.com/Nukesor) (Aug 2023): shared a sed workaround command -- people grateful, 7 hearts
  - [@ianselley](https://github.com/ianselley) (Oct 2023): still active on this thread
  - [@Apollo108](https://github.com/Apollo108) (Apr 2021): confused about how to use multiple filters
  - [@AdnanKazi](https://github.com/AdnanKazi) (Mar 2021): asked about multiple filters
  - **All related closed-as-duplicate issues** (each has frustrated users): [#50628](https://github.com/flutter/flutter/issues/50628), [#50794](https://github.com/flutter/flutter/issues/50794), [#51318](https://github.com/flutter/flutter/issues/51318), [#51281](https://github.com/flutter/flutter/issues/51281), [#51208](https://github.com/flutter/flutter/issues/51208), [#51696](https://github.com/flutter/flutter/issues/51696), [#53060](https://github.com/flutter/flutter/issues/53060), [#56831](https://github.com/flutter/flutter/issues/56831)
2. **[flutter/flutter#121326](https://github.com/flutter/flutter/issues/121326)** - "Option to disable D/EGL_emulation app_time_stats logs" -- Closed as "invalid" (not Flutter's problem). User [@bhavinb98](https://github.com/bhavinb98) specifically noted: *"Now if I want to see other important logs I have to use the same filter box for it which causes the spam to come back again, especially if you are working with videos on the app, hundreds of logs in a matter of seconds."*
3. **[flutter/flutter#37859](https://github.com/flutter/flutter/issues/37859)** - "Plenty of spam in logs while running flutter run" -- [@MaskyS](https://github.com/MaskyS): *"I can't really debug now."*
4. **[flutter/flutter#50768](https://github.com/flutter/flutter/issues/50768)** - "Lots of spam messages when running Flutter run" -- [@WanjiruCate](https://github.com/WanjiruCate) pasted hundreds of lines of BufferQueue/DynamiteModule/OpenSSL spam.
5. **[flutter/flutter-intellij#6274](https://github.com/flutter/flutter-intellij/issues/6274)** - "Hide logging spam" -- IntelliJ users with same problem, potential VS Code converts.
6. **[StackOverflow: "Flutter - how to filter debug console in vscode"](https://stackoverflow.com/questions/60259610)** - **25 upvotes, 13k views**. Key commenters:
  - [@rafitajaen](https://stackoverflow.com/users/12601236/rafitajaen) (OP, Feb 2020): *"These messages make it difficult for me to read the logs"*
  - Ali Briceno (comment, Feb 2020): *"After update to the latest version of flutter, the debug console becomes overwhelmed."*
  - David Papirov (Jun 2020): *"Any ideas to fix it?"*
  - Dani (Sep 2020): *"Also looking for a fix"*
  - manafire (Sep 2020): *"So brutal."*
7. **[StackOverflow: "Filter debug console output in VS code?"](https://stackoverflow.com/questions/57739775)** - General question, but Flutter devs in the comments.
8. **[StackOverflow: "When running my Flutter MacOs app through VSCode, my debug console prints thousands of lines"](https://stackoverflow.com/questions/75395720)** - macOS Flutter dev with same problem.

### B. No Log Level Filtering for Logcat (Level filtering)

Flutter devs specifically want Chrome DevTools-style level buttons to show only errors/warnings. Logcat lines already have level prefixes (V/D/I/W/E/F) but VS Code's debug console ignores them.

**Acquisition links:**

1. **[microsoft/vscode#93750](https://github.com/microsoft/vscode/issues/93750)** - "Debug Console NEEDS a filter" -- **18 thumbs-up**, filed by Flutter dev [@JCKodel](https://github.com/JCKodel). Key commenters:
  - [@JCKodel](https://github.com/JCKodel): *"FIND is not the same as FILTER... The problem is the spam nature of this dialog."* -- Included logcat screenshot showing `I/` and `E/` prefix filtering. Also filed [#99921](https://github.com/microsoft/vscode/issues/99921) ("Debug Console is useless").
  - [@jerryzhoujw](https://github.com/jerryzhoujw): Android video dev, *"not easy to hide in console by just use FIND"*
  - [@Elias-Graf](https://github.com/Elias-Graf): *"my application has different services and each one has its 'log tag'. I'd like to filter only 'test' using something like `/\[test\]/gm`"*
  - [@arhelmus](https://github.com/arhelmus): *"I have a wall of logs which produces faster than I can read"* -- Later built the PR for basic filtering.
2. **[microsoft/vscode#99921](https://github.com/microsoft/vscode/issues/99921)** - "Debug Console is useless" -- [@JCKodel](https://github.com/JCKodel) recorded a video showing broken selection/copy and called for rebuilding from scratch.
3. **[Dart-Code/Dart-Code#2108](https://github.com/Dart-Code/Dart-Code/issues/2108)** - "Debug Console always shows verbose output regardless of launch.json setting"
4. **[flutter/flutter#120711](https://github.com/flutter/flutter/issues/120711)** - "allow filtering of adb logcat by 'flutter' to be configured from CLI args"

### C. Can't Click File Paths in Debug Output (File path linking)

Dart uses `package:` URIs that VS Code doesn't recognize as clickable links. Stack traces work, but custom log output with file references doesn't.

**Acquisition links:**

1. **[microsoft/vscode#39063](https://github.com/microsoft/vscode/issues/39063)** - "Paths in Debug Console output are not linked" -- Filed by [@DanTup](https://github.com/DanTup) (Dart-Code maintainer himself). Closed as duplicate. No real fix implemented.
2. **[Dart-Code/Dart-Code#451](https://github.com/Dart-Code/Dart-Code/issues/451)** - "Make file references in Debug Output clickable"
3. **[Dart-Code/Dart-Code#4768](https://github.com/Dart-Code/Dart-Code/issues/4768)** - "Debug Console location metadata doesn't appear when not running in debug mode" -- URIs don't work, line numbers missing.
4. **[StackOverflow: "VisualCode - debug console - log so you can click through to source"](https://stackoverflow.com/questions/57387182)** - Dart dev [@BrettSutton](https://stackoverflow.com/users/8994998/brett-sutton) asking for clickable `package:` paths. 1k views.

### D. Can't Save/Persist Debug Logs (Log persistence)

Flutter devs lose all logs when the debug session ends. No way to save or review later.

**Acquisition links:**

1. **[microsoft/vscode#77849](https://github.com/microsoft/vscode/issues/77849)** - "VS Code (with Flutter) - How to save DEBUG CONSOLE logs to file?" -- Filed by Flutter dev [@GauravPatni](https://github.com/GauravPatni). Closed as **out-of-scope**. Key commenters wanting this reopened:
  - [@ItsCubeTime](https://github.com/ItsCubeTime) (Apr 2021): *"Is there a way of automating this? I would like to view my console output through a file in real-time"* (5 upvotes)
  - [@AxelFlores1990](https://github.com/AxelFlores1990) (Sep 2022): *"Please, theres any chance to reconsider open again this?"* (**14 upvotes**)

### E. ANSI Color / Display Issues (Normalization + ANSI stripping)

1. **[Dart-Code/Dart-Code#5302](https://github.com/Dart-Code/Dart-Code/issues/5302)** - "No ANSI colors in Debug Console with VSCode 1.94.0" -- Colors broke after update.
2. **[Dart-Code/Dart-Code#5460](https://github.com/Dart-Code/Dart-Code/issues/5460)** - Text appears transparent/invisible in debug console.

### F. Additional Pain Points Debug Console+ Could Address for Flutter Devs

- **Multiple filter patterns at once**: Users repeatedly ask about combining `!D/EGL` and `!D/BufferPool` filters ([#50808 comments](https://github.com/flutter/flutter/issues/50808#issuecomment-818537637), [@Apollo108](https://github.com/Apollo108)). Debug Console+'s AND/OR logic solves this.
- **Filter resets when searching**: When you type a search in VS Code's filter box, it replaces the exclusion filter, bringing back all the spam ([#121326](https://github.com/flutter/flutter/issues/121326)). Debug Console+ separates level filtering from text search.
- **dart:developer log() not always visible**: [Dart-Code#3653](https://github.com/Dart-Code/Dart-Code/issues/3653) -- logs from `dart:developer log()` don't appear in "Run" mode. Debug Console+ captures from the debug session differently.
- **Filter internal debug logs**: [Dart-Code#5215](https://github.com/Dart-Code/Dart-Code/issues/5215) -- users want to filter Dart extension's own internal logs.

---

# SEGMENT 2: Backend Devs with Tagged/Multi-Service Logs -- Deep Dive

## Their Pain Points (mapped to Debug Console+ features)

### A. Mixed Output from Multiple Services (Level filtering + Search + Tag highlighting)

Backend devs running microservices or multi-process apps in VS Code get all output mixed into one debug console with no way to separate by service/tag.

**Acquisition links:**

1. **[microsoft/vscode#93750 - @Elias-Graf comment](https://github.com/microsoft/vscode/issues/93750#issuecomment-638662462)** - *"my application has different services and each one has its 'log tag'. If I'm debugging a certain service, I don't want to be spammed by any other logs. Here is a real world example: `[request] fetching... [test] cannot fill cache... [ViewFilterService] Resolved 1 waiting listener`. I'd like to filter only 'test' using something like `/\[test\]/gm`."* -- This is **exactly** what Debug Console+ tag parsing does.
2. **[microsoft/vscode#93750 - @arhelmus comment](https://github.com/microsoft/vscode/issues/93750#issuecomment-656717160)** - *"Its actually really hard to get use of debug console in real world application which has lots of processes in. Basically, I have a wall of logs which produces faster than I can read and there is no reliable way for me to configure what I wanna see"* -- Later built VS Code's basic filter because the problem was so bad.
3. **[microsoft/vscode#228056](https://github.com/microsoft/vscode/issues/228056)** - "Multiple filtering keywords in the Debug Console window" -- Filed Sep 2024, closed Oct 2024. Users want to filter by multiple keywords simultaneously (e.g., show only lines containing "auth" OR "payment"). Currently impossible with built-in filter.
4. **[microsoft/vscode#239494](https://github.com/microsoft/vscode/issues/239494)** - Multi-process debugging issues -- breakpoints and output mixed across processes.
5. **[microsoft/vscode#184349](https://github.com/microsoft/vscode/issues/184349)** - Related to output confusion across multiple debug sessions.

### B. No Log Level Filtering for Tagged Logs (Level filtering + Smart parsing)

Backend devs using structured logging (e.g., `[INFO]`, `[ERROR]`, `[DEBUG]`) can't filter by level because VS Code doesn't parse these tags.

**Acquisition links:**

1. **[microsoft/vscode#105864](https://github.com/microsoft/vscode/issues/105864)** - "Support filtering debug console items by level" -- Closed **out-of-scope**. Key commenter:
  - [@ljurow](https://github.com/ljurow) (Feb 2025): *"The debug version of my javascript application outputs lots of things (as 'info' and 'verbose'), but when something goes wrong, the first thing I want to see are just the errors."*
2. **[StackOverflow: "How to set log level of debug console in VS Code to exclude console.debug?"](https://stackoverflow.com/questions/62565141)** - **13k views, 3 upvotes**. No native solution exists. Comment from [@binaryfunt](https://stackoverflow.com/users/3217306/binaryfunt) (May 2024): *"I don't see how this allows you to set the log level of the debug console"* -- confirming the problem still exists.
3. **[StackOverflow: "How to search the debug console in vscode?"](https://stackoverflow.com/questions/51268169)** - Users seeking search/filter, getting workarounds.

### C. No Regex or AND/OR Logic in Filter (Search with regex + AND/OR logic)

VS Code's built-in filter is plain text only. No regex, no boolean operators. Backend devs with complex logging patterns are stuck.

**Acquisition links:**

1. **[microsoft/vscode#93512](https://github.com/microsoft/vscode/issues/93512)** - Regex filter support requested for debug console.
2. **[microsoft/vscode#142922](https://github.com/microsoft/vscode/issues/142922)** - "Debug Console Filter is a bit confusing" -- Users report:
  - No clear indication when filter is active (logs silently disappear)
  - No dedicated clear button (hitting the wrong button clears entire console)
  - No search-within-filtered-results capability
3. **[microsoft/vscode#177579](https://github.com/microsoft/vscode/issues/177579)** - "Debug Console Search" -- User [@maher-saleh](https://github.com/maher-saleh) wanted search to highlight matches rather than filter everything else out, because filtering destroys context.
4. **[StackOverflow: "How do I filter problems by multiple criteria? AND or OR"](https://stackoverflow.com/questions/69915368)** - Users trying to combine filters in VS Code generally.

### D. Can't Save/Export Debug Logs for Analysis (Log persistence)

Backend devs debugging production-like scenarios lose everything when the session ends.

**Acquisition links:**

1. **[microsoft/vscode#77849](https://github.com/microsoft/vscode/issues/77849)** - (same as #17 above, but relevant to both segments)
2. **[microsoft/vscode#140859](https://github.com/microsoft/vscode/issues/140859)** - Request to log stdout/stderr to file during debugging via launch.json config.
3. **[microsoft/vscode#181590](https://github.com/microsoft/vscode/issues/181590)** - "Save variables to a file directly from the debugger" -- Closed as not planned.
4. **[StackOverflow: "Debugging using VS Code and piping terminal output to a file"](https://stackoverflow.com/questions/57871439)** - Users seeking log persistence workarounds.

### E. Performance Degradation with Verbose Apps (Virtual scrolling + Max logs)

Backend apps generating thousands of log lines per second cause the debug console to lag or freeze.

**Acquisition links:**

1. **[microsoft/vscode#249922](https://github.com/microsoft/vscode/issues/249922)** - "Evaluating expression of large objects from the debug console is extremely slow"
2. **[microsoft/vscode-js-debug#1433](https://github.com/microsoft/vscode-js-debug/issues/1433)** - JavaScript debugging slowness with large output.

### F. Additional Pain Points Debug Console+ Could Address for Backend Devs

- **Timestamps for performance debugging**: [#61298](https://github.com/microsoft/vscode/issues/61298) (44 upvotes) -- Backend devs need timestamps to measure request timing, identify bottlenecks. Relative timestamps would be especially useful.
- **Copying filtered output for bug reports/Slack**: [#28094](https://github.com/microsoft/vscode/issues/28094) -- devs need to share logs with teammates. Copy-filtered is essential.
- **AI querying logs**: Backend devs with complex multi-service architectures would benefit from asking AI "show me all errors from the auth service in the last 30 seconds."

---

# NEW PAIN POINTS NOT YET ADDRESSED (Potential Feature Ideas)

Based on this research, these are additional pain points from both segments that Debug Console+ could potentially solve with new features:

1. **Persistent filter presets / saved filters** -- Flutter devs type `!D/EGL !D/BufferPool !D/OpenSSL` every session. Being able to save and auto-apply filter presets would be huge. ([#121326](https://github.com/flutter/flutter/issues/121326), [#50808 comments](https://github.com/flutter/flutter/issues/50808))
2. **Per-tag/service log grouping or coloring** -- Backend devs want to visually distinguish `[auth]` vs `[payment]` vs `[request]` logs at a glance, not just filter to one. ([#93750 - @Elias-Graf](https://github.com/microsoft/vscode/issues/93750#issuecomment-638662462), [#197803](https://github.com/microsoft/vscode/issues/197803))
3. **Log level statistics / count badges** -- Show how many errors/warnings/info messages exist without reading through everything. Several users expressed wanting to "just see the errors" first. ([#105864 - @ljurow](https://github.com/microsoft/vscode/issues/105864))
4. **Exclusion patterns (negative filters)** -- The `!pattern` syntax in VS Code's filter is poorly discoverable. A dedicated "exclude" UI would help. ([#93750 - @JCKodel](https://github.com/microsoft/vscode/issues/93750))
5. **Export to structured format (JSON/CSV)** -- Beyond plain text copy, devs analyzing logs want structured export. ([#77849 - @ItsCubeTime](https://github.com/microsoft/vscode/issues/77849))
6. **Log diffing between sessions** -- "What changed between this run and the last one?" No tool offers this. Could be a differentiator.

---

# MASTER ACQUISITION LINK LIST

All links where users are actively complaining and could be reached:

## GitHub Issues (Flutter/Dart)


| #   | Link                                                                                     | Status | Engagement                       |
| --- | ---------------------------------------------------------------------------------------- | ------ | -------------------------------- |
| 1   | [flutter/flutter#50808](https://github.com/flutter/flutter/issues/50808)                 | Open   | 17 thumbs-up, 27 comments        |
| 2   | [flutter/flutter#121326](https://github.com/flutter/flutter/issues/121326)               | Closed | Active complainers               |
| 3   | [flutter/flutter#37859](https://github.com/flutter/flutter/issues/37859)                 | Closed | Spam complaints                  |
| 4   | [flutter/flutter#50768](https://github.com/flutter/flutter/issues/50768)                 | Closed | Massive spam example             |
| 5   | [flutter/flutter#50628](https://github.com/flutter/flutter/issues/50628)                 | Closed | Filtering removed                |
| 6   | [flutter/flutter#51318](https://github.com/flutter/flutter/issues/51318)                 | Closed | Verbose logs after upgrade       |
| 7   | [flutter/flutter#51281](https://github.com/flutter/flutter/issues/51281)                 | Closed | "thousands of spam logs"         |
| 8   | [flutter/flutter#51208](https://github.com/flutter/flutter/issues/51208)                 | Closed | "too many logs"                  |
| 9   | [flutter/flutter#51696](https://github.com/flutter/flutter/issues/51696)                 | Closed | "too much logs"                  |
| 10  | [flutter/flutter#53060](https://github.com/flutter/flutter/issues/53060)                 | Closed | "unwanted logs"                  |
| 11  | [flutter/flutter#56831](https://github.com/flutter/flutter/issues/56831)                 | Closed | "debug logs on every screen tap" |
| 12  | [flutter/flutter-intellij#6274](https://github.com/flutter/flutter-intellij/issues/6274) | Open   | "Hide logging spam"              |
| 13  | [Dart-Code/Dart-Code#2108](https://github.com/Dart-Code/Dart-Code/issues/2108)           | Closed | Verbose regardless of setting    |
| 14  | [Dart-Code/Dart-Code#4768](https://github.com/Dart-Code/Dart-Code/issues/4768)           | Open   | URIs/links broken                |
| 15  | [Dart-Code/Dart-Code#5302](https://github.com/Dart-Code/Dart-Code/issues/5302)           | Closed | ANSI colors broken               |
| 16  | [Dart-Code/Dart-Code#5215](https://github.com/Dart-Code/Dart-Code/issues/5215)           | Open   | Filter internal logs             |
| 17  | [Dart-Code/Dart-Code#451](https://github.com/Dart-Code/Dart-Code/issues/451)             | Closed | Clickable file refs              |


## GitHub Issues (VS Code core)


| #   | Link                                                                         | Status                | Engagement                                  |
| --- | ---------------------------------------------------------------------------- | --------------------- | ------------------------------------------- |
| 18  | [microsoft/vscode#105864](https://github.com/microsoft/vscode/issues/105864) | Closed (out-of-scope) | 7 thumbs-up, Feb 2025 comment               |
| 19  | [microsoft/vscode#93750](https://github.com/microsoft/vscode/issues/93750)   | Closed                | 18 thumbs-up, key commenters                |
| 20  | [microsoft/vscode#99921](https://github.com/microsoft/vscode/issues/99921)   | Closed                | "Debug Console is useless"                  |
| 21  | [microsoft/vscode#61298](https://github.com/microsoft/vscode/issues/61298)   | **Open**              | **44 thumbs-up**, 7+ years, bumped Jul 2025 |
| 22  | [microsoft/vscode#28094](https://github.com/microsoft/vscode/issues/28094)   | Closed                | Copy plain text request                     |
| 23  | [microsoft/vscode#187784](https://github.com/microsoft/vscode/issues/187784) | Open                  | Can't copy full values                      |
| 24  | [microsoft/vscode#2163](https://github.com/microsoft/vscode/issues/2163)     | Open                  | Multi-page selection                        |
| 25  | [microsoft/vscode#32632](https://github.com/microsoft/vscode/issues/32632)   | Open                  | Auto-scroll disable                         |
| 26  | [microsoft/vscode#10486](https://github.com/microsoft/vscode/issues/10486)   | Closed                | Smart scroll-lock                           |
| 27  | [microsoft/vscode#177579](https://github.com/microsoft/vscode/issues/177579) | Closed                | Search highlights                           |
| 28  | [microsoft/vscode#93512](https://github.com/microsoft/vscode/issues/93512)   | Closed                | Regex filter                                |
| 29  | [microsoft/vscode#142922](https://github.com/microsoft/vscode/issues/142922) | Closed                | Confusing filter UX                         |
| 30  | [microsoft/vscode#228056](https://github.com/microsoft/vscode/issues/228056) | Closed                | Multiple filter keywords                    |
| 31  | [microsoft/vscode#197803](https://github.com/microsoft/vscode/issues/197803) | **Open**              | Timestamps, log levels, styling             |
| 32  | [microsoft/vscode#77849](https://github.com/microsoft/vscode/issues/77849)   | Closed (out-of-scope) | Save logs to file, 14-upvote comment        |
| 33  | [microsoft/vscode#39063](https://github.com/microsoft/vscode/issues/39063)   | Closed                | File path linking                           |
| 34  | [microsoft/vscode#194080](https://github.com/microsoft/vscode/issues/194080) | Open                  | "Crazy tons of Just My Code logs"           |
| 35  | [microsoft/vscode#140859](https://github.com/microsoft/vscode/issues/140859) | Closed                | Log to file during debug                    |


## Stack Overflow Questions


| #   | Link                                                                                                       | Views    | Votes |
| --- | ---------------------------------------------------------------------------------------------------------- | -------- | ----- |
| 36  | [Flutter - how to filter debug console in vscode](https://stackoverflow.com/questions/60259610)            | **13k**  | 25    |
| 37  | [Filter debug console output in VS code?](https://stackoverflow.com/questions/57739775)                    | High     | 3     |
| 38  | [How to set log level of debug console in VS Code?](https://stackoverflow.com/questions/62565141)          | **13k**  | 3     |
| 39  | [How to search the debug console in vscode?](https://stackoverflow.com/questions/51268169)                 | High     | -     |
| 40  | [VisualCode - debug console - click through to source](https://stackoverflow.com/questions/57387182)       | 1k       | 1     |
| 41  | [Copy debug console to clipboard](https://stackoverflow.com/questions/37153675)                            | High     | -     |
| 42  | [VSCode debug console does not stay scrolled to bottom](https://stackoverflow.com/questions/69562861)      | Moderate | -     |
| 43  | [Flutter MacOS debug console prints thousands of lines](https://stackoverflow.com/questions/75395720)      | Moderate | -     |
| 44  | [Debugging using VS Code and piping terminal output to file](https://stackoverflow.com/questions/57871439) | Moderate | -     |
| 45  | [How to make vscode debugging less verbose?](https://stackoverflow.com/questions/60487986)                 | Moderate | -     |
| 46  | [How to hide unwanted log messages on VS Code, running Java](https://stackoverflow.com/questions/64297373) | Moderate | 3     |


## Highest-Priority Targets for User Acquisition

**Top 5 links with most active, reachable, frustrated users:**

1. **[flutter/flutter#50808](https://github.com/flutter/flutter/issues/50808)** -- Open, 17 thumbs-up, 27 comments, people still visiting. A comment here would reach the largest frustrated Flutter audience.
2. **[microsoft/vscode#61298](https://github.com/microsoft/vscode/issues/61298)** -- Open, 44 thumbs-up, actively bumped in 2025. Timestamp seekers would love Debug Console+.
3. **[StackOverflow: Flutter filter debug console (13k views)](https://stackoverflow.com/questions/60259610)** -- Answering with Debug Console+ as a solution would reach thousands of searching Flutter devs.
4. **[StackOverflow: Log level in VS Code debug console (13k views)](https://stackoverflow.com/questions/62565141)** -- Same high-traffic potential.
5. **[microsoft/vscode#197803](https://github.com/microsoft/vscode/issues/197803)** -- Open, requesting timestamps + log levels + styling. Debug Console+ delivers all of these.

