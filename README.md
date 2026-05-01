# Hyper Shell Manager

[中文文档](./README_CN.md)

A Hyper plugin for managing multiple shell profiles with easy switching and customization.

## Features

- 🔄 **Multiple Shell Profiles** - Manage and switch between different shell configurations (Git Bash, PowerShell, CMD, WSL, etc.)
- 🎨 **Customizable UI** - Theme support (system/dark/light), customizable position and width
- 💾 **State Persistence** - Remembers your last active profile across sessions
- ⚡ **Quick Switching** - Dropdown selector integrated into the Hyper UI
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
          env: {
            TERM: 'xterm-256color'
          }
        },
        powershell: {
          label: 'PowerShell',
          shell: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
          shellArgs: [],
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
2. **Automatic Activation**: The plugin remembers your last selected profile and activates it on startup.
3. **Apply Changes**: Selecting a new profile from the dropdown will reload the terminal with the new shell configuration.

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
      env: { TERM: 'xterm-256color' }
    },
    pwsh: {
      label: 'PowerShell 7',
      shell: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
      shellArgs: ['-NoLogo'],
      env: {}
    },
    cmd: {
      label: 'CMD',
      shell: 'C:\\Windows\\System32\\cmd.exe',
      shellArgs: [],
      env: {}
    },
    wsl: {
      label: 'Ubuntu (WSL)',
      shell: 'C:\\Windows\\System32\\wsl.exe',
      shellArgs: ['-d', 'Ubuntu-20.04'],
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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Author

Created for the Hyper community.

## Support

If you encounter any issues or have suggestions, please [open an issue](https://github.com/your-username/hyper-shell-manager/issues) on GitHub.
