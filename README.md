# Hyper Shell Manager

[中文文档](./README_CN.md)

A Hyper plugin for managing multiple shell profiles with dropdown switching, hotkeys that directly open profile-specific tabs, and customization.

## Features

- 🔄 **Multiple Shell Profiles** - Manage and switch between different shell configurations (Git Bash, PowerShell, CMD, WSL, etc.)
- 🎨 **Customizable UI** - Theme support (system/dark/light), customizable position and width
- 💾 **State Persistence** - Remembers your last active profile across sessions
- ⚡ **Quick Switching** - Dropdown selector integrated into the Hyper UI
- ⌨️ **Hotkey New Tabs** - Bind a shortcut to each shell profile and open a new tab directly with that shell
- 🌍 **Environment Variables** - Set custom environment variables per profile
- 📁 **Flexible Configuration** - Configure in `.hyper.js` or separate config file

## Installation

### Via Hyper CLI

```bash
hyper install hyper-shell-manager
```

### Via npm

```bash
npm install -g hyper-shell-manager
```

### Manual Installation

1. Navigate to Hyper's plugins directory:
   - **macOS**: `~/.hyper/plugins/`
   - **Windows**: `%APPDATA%\Hyper\plugins\`
   - **Linux**: `~/.config/Hyper/plugins/`

2. Clone or download this repository into the plugins folder:
   ```bash
   cd ~/.hyper/plugins
   git clone https://github.com/your-username/hyper-shell-manager.git
   ```

3. Restart Hyper.

## Configuration

Add the configuration to your `.hyper.js` file (located in your home directory):

```javascript
module.exports = {
  config: {
    // ... other Hyper config
    
    hyperShellManager: {
      // Default profile name (optional)
      defaultProfile: 'gitbash',
      
      // Shell profiles configuration
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

      // You can also configure hotkeys centrally (optional, overrides profile.hotkey)
      hotkeys: {
        gitbash: 'Ctrl + Alt + G',
        powershell: 'Ctrl + Alt + P'
      },
      
      // UI customization (optional)
      ui: {
        label: 'Shell:',           // Label text (set to "" to hide)
        theme: 'system',            // Theme: "system", "dark", "light"
        width: '56px',             // Width of the selector
        top: '9px',                // Top position
        right: '156px',            // Right position (leave empty for left positioning)
        left: ''                   // Left position (alternative to right)
      }
    }
  }
  // ... plugins
};
```

### Profile Configuration

Each profile in the `profiles` object supports the following properties:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `label` | String | No | Display name for the profile (defaults to profile key) |
| `shell` | String | Yes | Absolute path to the shell executable |
| `shellArgs` | Array | No | Array of command-line arguments to pass to the shell |
| `hotkey` | String | No | Shortcut for opening a new tab with this profile. Use the full form, for example `Ctrl + Alt + G`, `Ctrl + Alt + P`, or `Ctrl + Alt + K`. On macOS the same shortcut is displayed and matched as `Cmd + Option + key`. |
| `env` | Object | No | Environment variables to set for this profile |

### UI Configuration

The `ui` object allows you to customize the appearance of the shell selector:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `label` | String | `""` | Label text before the dropdown (empty string to hide) |
| `theme` | String | `"system"` | Theme: `"system"`, `"dark"`, or `"light"` |
| `width` | String | `"56px"` | Width of the selector dropdown |
| `top` | String | `"9px"` | Top position offset |
| `right` | String | `"156px"` | Right position offset |
| `left` | String | `""` | Left position offset (alternative to `right`) |

### Platform-Specific Shell Paths

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

## Usage

1. **Select a Profile**: Use the dropdown selector that appears in the Hyper window to switch between configured shell profiles.
2. **Use Hotkeys to Open New Tabs**: Add a `hotkey` to a profile, then press that shortcut in Hyper to immediately create a new tab using that profile's `shell`, `shellArgs`, and `env`. You can also use a top-level `hotkeys` map, for example `hotkeys: { gitbash: 'Ctrl + Alt + G', powershell: 'Ctrl + Alt + P', wsl: 'Ctrl + Alt + K' }`.
3. **Automatic Activation**: The plugin remembers your last selected profile and activates it on startup.
4. **Apply Changes**: Selecting from the dropdown still switches the default active profile and reloads Hyper config; pressing a hotkey does not switch first, it directly opens a new tab with the matching shell.

### Hotkey Syntax

Hotkeys can be configured either inside each profile as `hotkey`, or centrally in `hyperShellManager.hotkeys`. When triggered, the shortcut directly opens a new tab; you do not need to manually create a tab afterward.

Hotkeys are intentionally fixed to `Ctrl + Alt + letter`; on macOS the same config automatically maps to `Cmd + Option + letter`. Configure the full form, such as `Ctrl + Alt + G`, `Ctrl + Alt + P`, `Ctrl + Alt + K`, or `Ctrl + Alt + U`; the UI also displays the full shortcut. Number keys are no longer supported, so `Ctrl + Alt + 1` is ignored. Other combinations such as `Shift`, `Mod`, or `Cmd` are no longer supported to avoid collisions with Hyper or system shortcuts.

## Example Configurations

### Windows Developer Setup

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

### macOS Developer Setup

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

### Custom Environment Variables

```javascript
hyperShellManager: {
  profiles: {
    dev: {
      label: 'Dev Environment',
      shell: '/bin/bash',
      shellArgs: [],
      env: {
        NODE_ENV: 'development',
        API_URL: 'http://localhost:3000',
        DEBUG: 'true'
      }
    },
    prod: {
      label: 'Production',
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

## Alternative Configuration File

You can also place configuration in a separate `.hyperrc.js` or `.hyperrc.json` file in your home directory:

### `.hyperrc.js` Example

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

## Troubleshooting

### Shell not found
- Ensure the `shell` path is correct and uses double backslashes (`\\`) on Windows
- Verify the shell executable exists at the specified path

### Profile not switching
- Check the console for error messages (View > Toggle Developer Tools)
- Verify the profile name matches exactly
- Restart Hyper after making configuration changes

### UI selector not visible
- Check that the plugin is installed and listed in `.hyper.js` plugins array
- Verify the `ui.position` values don't place it off-screen
- Try adjusting `top`, `right`, or `left` values

## License

MIT License - see the [LICENSE](LICENSE) file for details.
