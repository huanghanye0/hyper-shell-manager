# Hyper Shell Manager

[English Documentation](./README.md)

一个 Hyper 插件用于管理多个 shell 配置文件，支持下拉切换、快捷键直接打开指定 shell 的新标签页，以及自定义设置。

## 功能特性

- 🔄 **多 Shell 配置管理** - 管理和切换不同的 shell 配置（Git Bash、PowerShell、CMD、WSL 等）
- 🎨 **可自定义界面** - 支持主题（system/dark/light），可自定义位置和宽度
- 💾 **状态持久化** - 记住上次激活的配置文件，跨会话保持
- ⚡ **快速切换** - 集成在 Hyper UI 中的下拉选择器
- ⌨️ **快捷键新标签页** - 可为每个 shell 配置绑定快捷键，按下后直接打开对应 shell 的新标签页
- 🌍 **环境变量** - 为每个配置文件设置自定义环境变量
- 📁 **灵活配置** - 可在 `.hyper.js` 或独立配置文件中配置

## 安装

### 通过 Hyper CLI 安装

```bash
hyper install hyper-shell-manager
```

### 通过 npm 安装

```bash
npm install -g hyper-shell-manager
```

### 手动安装

1. 进入 Hyper 插件目录：
   - **macOS**: `~/.hyper/plugins/`
   - **Windows**: `%APPDATA%\Hyper\plugins\`
   - **Linux**: `~/.config/Hyper/plugins/`

2. 将仓库克隆或下载到插件文件夹：
   ```bash
   cd ~/.hyper/plugins
   git clone https://github.com/your-username/hyper-shell-manager.git
   ```

3. 重启 Hyper。

## 配置

在 `.hyper.js` 文件中添加配置（位于用户主目录）：

```javascript
module.exports = {
  config: {
    // ... 其他 Hyper 配置
    
    hyperShellManager: {
      // 默认配置名称（可选）
      defaultProfile: 'gitbash',
      
      // Shell 配置文件
      profiles: {
        gitbash: {
          label: 'Git Bash',
          shell: 'C:\\Program Files\\Git\\bin\\bash.exe',
          shellArgs: ['-i', '-l'],
          hotkey: 'Ctrl + Alt + G',
          env: {
            TERM: 'xterm-256color'
          }
        },
        powershell: {
          label: 'PowerShell',
          shell: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
          shellArgs: [],
          hotkey: 'Ctrl + Alt + P',
          env: {}
        },
        cmd: {
          label: 'CMD',
          shell: 'C:\\Windows\\System32\\cmd.exe',
          shellArgs: [],
          env: {}
        },
        wsl: {
          label: 'WSL Ubuntu',
          shell: 'C:\\Windows\\System32\\wsl.exe',
          shellArgs: ['-d', 'Ubuntu'],
          env: {}
        }
      },

      // 也可以集中配置快捷键（可选，会覆盖 profile.hotkey）
      hotkeys: {
        gitbash: 'Ctrl + Alt + G',
        powershell: 'Ctrl + Alt + P'
      },
      
      // UI 自定义（可选）
      ui: {
        label: 'Shell:',           // 标签文本（设为 "" 可隐藏）
        theme: 'system',            // 主题: "system", "dark", "light"
        width: '56px',             // 选择器宽度
        top: '9px',                // 顶部位置
        right: '156px',            // 右侧位置（留空则使用左侧定位）
        left: ''                   // 左侧位置（替代右侧定位）
      }
    }
  }
  // ... 插件列表
};
```

### 配置文件说明

`profiles` 对象中的每个配置支持以下属性：

| 属性 | 类型 | 必填 | 说明 |
|----------|------|----------|-------------|
| `label` | String | 否 | 配置的显示名称（默认为配置键名） |
| `shell` | String | 是 | Shell 可执行文件的绝对路径 |
| `shellArgs` | Array | 否 | 传递给 shell 的命令行参数数组 |
| `hotkey` | String | 否 | 直接打开该配置新标签页的快捷键。请写完整形式，例如 `Ctrl + Alt + G`、`Ctrl + Alt + P`、`Ctrl + Alt + K`。macOS 会自动显示并匹配为 `Cmd + Option + 按键`。 |
| `env` | Object | 否 | 为此配置设置的环境变量 |

### UI 配置说明

`ui` 对象允许自定义 shell 选择器的外观：

| 属性 | 类型 | 默认值 | 说明 |
|----------|------|---------|-------------|
| `label` | String | `""` | 下拉框前的标签文本（空字符串隐藏） |
| `theme` | String | `"system"` | 主题：`"system"`、`"dark"` 或 `"light"` |
| `width` | String | `"56px"` | 选择器下拉框的宽度 |
| `top` | String | `"9px"` | 顶部位置偏移量 |
| `right` | String | `"156px"` | 右侧位置偏移量 |
| `left` | String | `""` | 左侧位置偏移量（替代 `right`） |

### 各平台 Shell 路径

#### Windows
- **Git Bash**: `C:\\Program Files\\Git\\bin\\bash.exe`
- **PowerShell**: `C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
- **PowerShell Core**: `C:\\Program Files\\PowerShell\\7\\pwsh.exe`
- **CMD**: `C:\\Windows\\System32\\cmd.exe`
- **WSL**: `C:\\Windows\\System32\\wsl.exe`

#### macOS
- **Zsh**: `/bin/zsh`
- **Bash**: `/bin/bash`
- **Fish**: `/usr/local/bin/fish`

#### Linux
- **Bash**: `/bin/bash`
- **Zsh**: `/usr/bin/zsh`
- **Fish**: `/usr/bin/fish`

## 使用方法

1. **选择配置文件**：使用 Hyper 窗口中显示的下拉选择器在已配置的 shell 配置文件之间切换。
2. **使用快捷键打开新标签页**：在 profile 中添加 `hotkey` 后，在 Hyper 中按下对应快捷键会立即新建一个标签页，并让该标签页直接使用对应的 `shell`、`shellArgs` 和 `env`。也可以使用顶层 `hotkeys` 映射，例如 `hotkeys: { gitbash: 'Ctrl + Alt + G', powershell: 'Ctrl + Alt + P', wsl: 'Ctrl + Alt + K' }`。
3. **自动激活**：插件会记住您上次选择的配置文件，并在启动时激活它。
4. **应用更改**：从下拉框选择 profile 仍会切换默认 active profile 并重新加载 Hyper 配置；快捷键不会先切换默认 profile，而是直接打开一个对应 shell 的新标签页。

### 快捷键语法

快捷键支持两种写法：在 profile 内写 `hotkey`，或在 `hyperShellManager.hotkeys` 中集中配置。快捷键触发后会直接打开新标签页，不会等待你再手动新建 tab。

快捷键固定为 `Ctrl + Alt + 字母`；macOS 会自动适配为 `Cmd + Option + 字母`。配置时请写完整形式，例如 `Ctrl + Alt + G`、`Ctrl + Alt + P`、`Ctrl + Alt + K`、`Ctrl + Alt + U`，界面提示也会显示完整组合键。数字键不再支持，例如 `Ctrl + Alt + 1` 会被忽略；也不支持 `Shift`、`Mod`、`Cmd` 等其他组合，以避免和 Hyper / 系统快捷键冲突。

## 配置示例

### Windows 开发环境配置

```javascript
hyperShellManager: {
  defaultProfile: 'pwsh',
  profiles: {
    gitbash: {
      label: 'Git Bash',
      shell: 'C:\\Program Files\\Git\\bin\\bash.exe',
      shellArgs: ['-i', '-l'],
      hotkey: 'Ctrl + Alt + G',
      env: { TERM: 'xterm-256color' }
    },
    pwsh: {
      label: 'PowerShell 7',
      shell: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
      shellArgs: ['-NoLogo'],
      hotkey: 'Ctrl + Alt + P',
      env: {}
    },
    cmd: {
      label: 'CMD',
      shell: 'C:\\Windows\\System32\\cmd.exe',
      shellArgs: [],
      hotkey: 'Ctrl + Alt + K',
      env: {}
    },
    wsl: {
      label: 'Ubuntu (WSL)',
      shell: 'C:\\Windows\\System32\\wsl.exe',
      shellArgs: ['-d', 'Ubuntu-20.04'],
      hotkey: 'Ctrl + Alt + U',
      env: { WSLENV: 'PATH/l' }
    }
  },
  ui: {
    label: '',
    theme: 'system',
    width: '70px',
    top: '9px',
    right: '156px'
  }
}
```

### macOS 开发环境配置

```javascript
hyperShellManager: {
  defaultProfile: 'zsh',
  profiles: {
    zsh: {
      label: 'Zsh',
      shell: '/bin/zsh',
      shellArgs: [],
      env: { SHELL: '/bin/zsh' }
    },
    bash: {
      label: 'Bash',
      shell: '/bin/bash',
      shellArgs: ['-l'],
      env: { SHELL: '/bin/bash' }
    },
    fish: {
      label: 'Fish',
      shell: '/usr/local/bin/fish',
      shellArgs: [],
      env: { SHELL: '/usr/local/bin/fish' }
    }
  }
}
```

### 自定义环境变量

```javascript
hyperShellManager: {
  profiles: {
    dev: {
      label: '开发环境',
      shell: '/bin/bash',
      shellArgs: [],
      env: {
        NODE_ENV: 'development',
        API_URL: 'http://localhost:3000',
        DEBUG: 'true'
      }
    },
    prod: {
      label: '生产环境',
      shell: '/bin/bash',
      shellArgs: [],
      env: {
        NODE_ENV: 'production',
        API_URL: 'https://api.example.com'
      }
    }
  }
}
```

## 独立配置文件

您也可以将配置放在主目录下的独立 `.hyperrc.js` 或 `.hyperrc.json` 文件中：

### `.hyperrc.js` 示例

```javascript
module.exports = {
  hyperShellManager: {
    profiles: {
      gitbash: {
        label: 'Git Bash',
        shell: 'C:\\Program Files\\Git\\bin\\bash.exe',
        shellArgs: ['-i', '-l'],
        env: {}
      }
    }
  }
};
```

## 常见问题

### 找不到 Shell
- 确保 `shell` 路径正确，在 Windows 上使用双反斜杠（`\\`）
- 验证 shell 可执行文件存在于指定路径

### 配置文件未切换
- 检查控制台的错误消息（查看 > 切换开发者工具）
- 验证配置名称完全匹配
- 修改配置后重启 Hyper

### UI 选择器不可见
- 检查插件是否已安装并列在 `.hyper.js` 的 plugins 数组中
- 验证 `ui.position` 值没有将其放置在屏幕外
- 尝试调整 `top`、`right` 或 `left` 值

## 许可证

MIT 许可证 - 详情请查看 [LICENSE](LICENSE) 文件。

