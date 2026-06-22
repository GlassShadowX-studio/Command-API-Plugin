const I18N = {
  en: {
    title: ' Command+ FileUI ',
    header_name: ' Name', header_size: 'Size', header_modified: 'Modified',
    help_nav: ' [↑/↓] Nav ', help_open: ' [Enter] Open ', help_up: ' [Esc] Up ', help_quit: ' [q] Quit ',
    err_tty: 'Error: fileui requires an interactive terminal (TTY).',
    err_read: 'Error reading directory', msg_root: 'Already at root directory.',
    file_info: 'File: {name} | Size: {size} | Modified: {time}'
  },
  zh: {
    title: ' Command+ 文件浏览器 ',
    header_name: ' 名称', header_size: '大小', header_modified: '修改时间',
    help_nav: ' [↑/↓] 导航 ', help_open: ' [Enter] 打开 ', help_up: ' [Esc] 返回 ', help_quit: ' [q] 退出 ',
    err_tty: '错误: fileui 需要交互式终端 (TTY)。',
    err_read: '读取目录错误', msg_root: '已在根目录。',
    file_info: '文件: {name} | 大小: {size} | 修改时间: {time}'
  },
  es: {
    title: ' Command+ Explorador ',
    header_name: ' Nombre', header_size: 'Tamaño', header_modified: 'Modificado',
    help_nav: ' [↑/↓] Nav ', help_open: ' [Enter] Abrir ', help_up: ' [Esc] Subir ', help_quit: ' [q] Salir ',
    err_tty: 'Error: fileui requiere terminal interactiva (TTY).',
    err_read: 'Error al leer el directorio', msg_root: 'Ya está en el directorio raíz.',
    file_info: 'Archivo: {name} | Tamaño: {size} | Modificado: {time}'
  },
  ru: {
    title: ' Command+ Файловый менеджер ',
    header_name: ' Имя', header_size: 'Размер', header_modified: 'Изменено',
    help_nav: ' [↑/↓] Навигация ', help_open: ' [Enter] Открыть ', help_up: ' [Esc] Вверх ', help_quit: ' [q] Выход ',
    err_tty: 'Ошибка: fileui требует интерактивный терминал (TTY).',
    err_read: 'Ошибка чтения каталога', msg_root: 'Уже в корневом каталоге.',
    file_info: 'Файл: {name} | Размер: {size} | Изменено: {time}'
  }
};

function t(key, args = {}, lang = 'en') {
  let str = I18N[lang] && I18N[lang][key] ? I18N[lang][key] : (I18N.en[key] || key);
  for (const k in args) str = str.replace(`{${k}}`, args[k]);
  return str;
}

// ==========================================
// 核心：终端可见宽度计算引擎 (解决中文溢出与对齐问题)
// ==========================================
function getCharWidth(char) {
  const code = char.codePointAt(0);
  // 判断全角字符 (CJK、全角符号等) 宽度为 2，其余为 1
  if (
    (code >= 0x1100 && code <= 0x115F) || (code >= 0x2E80 && code <= 0x303E) ||
    (code >= 0x3040 && code <= 0x33BF) || (code >= 0x3400 && code <= 0x4DBF) ||
    (code >= 0x4E00 && code <= 0x9FFF) || (code >= 0xAC00 && code <= 0xD7AF) ||
    (code >= 0xF900 && code <= 0xFAFF) || (code >= 0xFE10 && code <= 0xFE6F) ||
    (code >= 0xFF01 && code <= 0xFF60) || (code >= 0xFFE0 && code <= 0xFFE6) ||
    (code >= 0x20000 && code <= 0x2FFFF)
  ) return 2;
  return 1;
}

function getVisibleWidth(str) {
  // 剥离 ANSI 转义码后计算真实显示宽度
  const clean = str.replace(/\x1b\[[0-9;]*m/g, '');
  let w = 0;
  for (const c of clean) w += getCharWidth(c);
  return w;
}

function padEndVis(str, len) {
  const diff = len - getVisibleWidth(str);
  return diff > 0 ? str + ' '.repeat(diff) : str;
}

function padStartVis(str, len) {
  const diff = len - getVisibleWidth(str);
  return diff > 0 ? ' '.repeat(diff) + str : str;
}

function truncateVis(str, maxW) {
  let w = 0, res = '';
  for (const c of str) {
    const cw = getCharWidth(c);
    if (w + cw > maxW - 1) return res + '…'; // 留1位给省略号
    res += c; w += cw;
  }
  return res;
}

module.exports = [
  {
    name: 'fileui',
    description: {
      en: 'Interactive visual file system browser (TUI)',
      zh: '交互式可视化文件结构浏览器 (TUI)',
      es: 'Explorador de archivos visual interactivo (TUI)',
      ru: 'Интерактивный визуальный браузер файлов (TUI)'
    },
    help: {
      en: `c fileui [directory] [-c]\n\nDESCRIPTION:\n Interactive TUI file browser.\n\nARGUMENTS:\n directory (Optional) Start path.\n -c (Optional) Enable colored UI.`,
      zh: `c fileui [目录] [-c]\n\n功能描述:\n 交互式 TUI 文件浏览器。\n\n参数说明:\n 目录 (可选) 起始路径。\n -c (可选) 启用彩色 UI。`,
      es: `c fileui [directorio] [-c]\n\nDESCRIPCIÓN:\n Explorador TUI interactivo.`,
      ru: `c fileui [каталог] [-c]\n\nОПИСАНИЕ:\n Интерактивный TUI браузер.`
    },
    run: async function(args, ctx) {
      if (!process.stdin.isTTY || !process.stdout.isTTY) {
        console.error(t('err_tty', {}, ctx.state.lang));
        process.exit(1);
      }

      let currentDir = process.cwd();
      let useColor = false;
      for (const arg of args) {
        if (arg === '-c') useColor = true;
        else if (!arg.startsWith('-')) currentDir = ctx.path.resolve(arg);
      }

      let items = [];
      let selectedIndex = 0;
      let scrollOffset = 0;
      let message = '';

      // 现代高对比度配色方案
      const C = useColor ? {
        reset: '\x1b[0m',
        titleBg: '\x1b[44m\x1b[97m\x1b[1m',   // 深蓝底白字粗体
        titlePath: '\x1b[44m\x1b[36m',         // 深蓝底青字
        header: '\x1b[1;94m',                  // 浅蓝粗体
        line: '\x1b[90m',                      // 灰色分隔线
        dirTag: '\x1b[1;33m',                  // 目录Tag 黄色粗体
        dirName: '\x1b[1;33m',                 // 目录名 黄色粗体
        fileTag: '\x1b[90m',                   // 文件Tag 灰色
        fileName: '\x1b[37m',                  // 文件名 白色
        size: '\x1b[36m',                      // 大小 青色
        time: '\x1b[90m',                      // 时间 灰色
        selectedBg: '\x1b[48;5;238m\x1b[97m',  // 选中行：深灰底白字 (避免反色变白)
        helpBg: '\x1b[42m\x1b[97m\x1b[1m',     // 底部栏：深绿底白字粗体
        msg: '\x1b[33m\x1b[1m',                // 提示 黄色粗体
        empty: '\x1b[90m'                      // 空行 灰色
      } : {
        reset: '\x1b[0m', titleBg: '', titlePath: '', header: '', line: '',
        dirTag: '', dirName: '', fileTag: '', fileName: '', size: '', time: '',
        selectedBg: '\x1b[1;4m', // 非彩色模式：加粗+下划线 (彻底解决背景变白)
        helpBg: '', msg: '\x1b[33m', empty: '\x1b[90m'
      };

      function loadDir() {
        try {
          const entries = ctx.fs.readdirSync(currentDir, { withFileTypes: true });
          items = entries.map(e => {
            let isDir = e.isDirectory();
            if (e.isSymbolicLink() && !isDir) {
              try { isDir = ctx.fs.statSync(ctx.path.join(currentDir, e.name)).isDirectory(); } catch {}
            }
            return { name: e.name, isDir, size: null, mtime: null };
          });
          items.sort((a, b) => {
            if (a.isDir && !b.isDir) return -1;
            if (!a.isDir && b.isDir) return 1;
            return a.name.localeCompare(b.name);
          });
          const root = ctx.path.parse(currentDir).root;
          if (currentDir !== root) items.unshift({ name: '..', isDir: true, size: 0, mtime: null, isParent: true });
          selectedIndex = 0; scrollOffset = 0;
        } catch (e) {
          message = `${t('err_read', {}, ctx.state.lang)}: ${e.message}`;
          items = [];
        }
      }

      function formatSize(bytes) {
        if (bytes === 0 || bytes === null || bytes === undefined) return '-';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let i = 0;
        while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
        return `${bytes.toFixed(1)} ${units[i]}`;
      }

      function ensureStat(item) {
        if (item.size === null && !item.isParent) {
          try {
            const s = ctx.fs.statSync(ctx.path.join(currentDir, item.name));
            item.size = s.size; item.mtime = s.mtime;
          } catch { item.size = 0; item.mtime = new Date(); }
        }
      }

      function render() {
        const rows = process.stdout.rows || 24;
        const cols = process.stdout.columns || 80;
        const listHeight = Math.max(5, rows - 4);

        let out = '\x1b[2J\x1b[H\x1b[?25l'; 

        // [顶部标题栏]
        const titleStr = t('title', {}, ctx.state.lang);
        const titleW = getVisibleWidth(titleStr);
        const pathMaxW = cols - titleW - 1;
        const pPath = truncateVis(currentDir, pathMaxW);
        const rawTitle = `${titleStr} ${pPath}`;
        
        let titleLine = '';
        if (useColor) {
          titleLine = `${C.titleBg}${titleStr}${C.reset}${C.titlePath} ${pPath}${C.reset}`;
          const curW = getVisibleWidth(titleLine);
          if (curW < cols) titleLine += ' '.repeat(cols - curW);
        } else {
          titleLine = `\x1b[7m${padEndVis(rawTitle, cols)}${C.reset}`;
        }
        out += titleLine + '\n';

        // [表头]
        const nameHeader = t('header_name', {}, ctx.state.lang);
        const sizeHeader = t('header_size', {}, ctx.state.lang);
        const timeHeader = t('header_modified', {}, ctx.state.lang);
        
        const tagW = 6, sizeW = 10, timeW = 19;
        const nameW = cols - tagW - sizeW - timeW - 3;

        const hName = padEndVis(nameHeader, nameW + 1); // +1 for space after tag
        const hSize = padStartVis(sizeHeader, sizeW);
        const hTime = timeHeader;
        
        out += `${C.header}${hName} ${hSize} ${hTime}${C.reset}\n`;
        out += `${C.line}${'─'.repeat(cols)}${C.reset}\n`;

        // [文件列表]
        if (selectedIndex < scrollOffset) scrollOffset = selectedIndex;
        if (selectedIndex >= scrollOffset + listHeight) scrollOffset = selectedIndex - listHeight + 1;

        for (let i = 0; i < listHeight; i++) {
          const idx = scrollOffset + i;
          if (idx < items.length) {
            const item = items[idx];
            const isSelected = idx === selectedIndex;
            ensureStat(item);

            const tagStr = item.isParent ? '[..]' : (item.isDir ? '[DIR]' : '[FIL]');
            const nameStr = truncateVis(item.name, nameW);
            const sizeStr = item.isDir ? '-' : formatSize(item.size);
            const timeStr = item.mtime ? item.mtime.toISOString().replace('T', ' ').substring(0, 19) : '-';

            const pTag = padEndVis(tagStr, tagW);
            const pName = padEndVis(nameStr, nameW);
            const pSize = padStartVis(sizeStr, sizeW);

            // 组装纯文本行 (确保宽度严格等于 cols)
            const rawLine = `${pTag} ${pName} ${pSize} ${timeStr}`;

            let coloredLine = '';
            if (useColor) {
              const cTag = item.isDir ? C.dirTag : C.fileTag;
              const cName = item.isDir ? C.dirName : C.fileName;
              coloredLine = `${cTag}${pTag}${C.reset} ${cName}${pName}${C.reset} ${C.size}${pSize}${C.reset} ${C.time}${timeStr}${C.reset}`;
            } else {
              coloredLine = rawLine;
            }

            if (isSelected) {
              // 选中行：彩色用深灰底，非彩色用加粗下划线
              coloredLine = `${C.selectedBg}${coloredLine}${C.reset}`;
            }
            
            // 兜底：确保整行宽度不超过 cols，防止换行
            const finalW = getVisibleWidth(coloredLine);
            if (finalW < cols) coloredLine += ' '.repeat(cols - finalW);
            else if (finalW > cols) coloredLine = truncateVis(coloredLine.replace(/\x1b\[[0-9;]*m/g, ''), cols); // 极端情况截断

            out += coloredLine + '\n';
          } else {
            out += `${C.empty}~${C.reset}\n`;
          }
        }

        // [底部状态栏]
        const helpStr = `${t('help_nav')} ${t('help_open')} ${t('help_up')} ${t('help_quit')}`;
        const rawHelp = padEndVis(helpStr, cols);
        const helpLine = useColor ? `${C.helpBg}${rawHelp}${C.reset}` : `\x1b[7m${rawHelp}${C.reset}`;
        out += helpLine + '\n';

        if (message) {
          out += `${C.msg}${truncateVis(message, cols)}${C.reset}`;
          message = '';
        }

        process.stdout.write(out);
      }

      function cleanup() {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write('\x1b[2J\x1b[H\x1b[?25h'); 
      }

      loadDir(); render();
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      ctx.readline.emitKeypressEvents(process.stdin);

      process.stdin.on('keypress', (str, key) => {
        if (key && key.ctrl && key.name === 'c') { cleanup(); process.exit(0); }
        if (key.name === 'up') { if (selectedIndex > 0) selectedIndex--; }
        else if (key.name === 'down') { if (selectedIndex < items.length - 1) selectedIndex++; }
        else if (key.name === 'return') {
          const item = items[selectedIndex];
          if (item) {
            if (item.isDir) {
              currentDir = item.isParent ? ctx.path.dirname(currentDir) : ctx.path.join(currentDir, item.name);
              loadDir();
            } else {
              ensureStat(item);
              const timeStr = item.mtime ? item.mtime.toLocaleString() : 'N/A';
              message = t('file_info', { name: item.name, size: formatSize(item.size), time: timeStr }, ctx.state.lang);
            }
          }
        } else if (key.name === 'escape' || key.name === 'backspace') {
          const root = ctx.path.parse(currentDir).root;
          if (currentDir !== root) { currentDir = ctx.path.dirname(currentDir); loadDir(); }
          else { message = t('msg_root', {}, ctx.state.lang); }
        } else if (key.name === 'q' || key.name === 'Q') { cleanup(); process.exit(0); }
        render();
      });

      process.stdout.on('resize', () => render());
    }
  }
];