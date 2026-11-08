# SusuEdition

Editor de vídeos e fotos para **Windows 11** e **Android**, feito com [Tauri v2](https://v2.tauri.app), React e shadcn/ui.

- **Video Maker** — fotos + vídeos + música, sincronização com as batidas, export MP4 até 4K.
- **Photo Collage** — layouts, margens e filtros.

📄 [PLAN.md](PLAN.md) (arquitetura) · [SPEC.md](SPEC.md) (especificações) · [ROADMAP.md](ROADMAP.md) (marcos) · [docs/adr](docs/adr) (decisões)

## Requisitos

| Ferramenta | Versão |
| --- | --- |
| Node.js | ≥ 22.12 |
| pnpm | 10 (`corepack enable`) |
| Rust | stable (≥ 1.85) |
| Windows | WebView2 (já incluso no Windows 11), Build Tools do Visual Studio (C++) |
| Android | Android Studio, SDK 35, NDK 27, JDK 17 |

### Configurar Android (uma vez)

1. Instale o **Android Studio** → SDK Manager: *Android SDK Platform 35*, *Platform-Tools*, *Build-Tools*, *NDK (Side by side)*, *Command-line Tools*.
2. Variáveis de ambiente (PowerShell):
   ```powershell
   [Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")
   [Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
   $ndk = Get-ChildItem "$env:LOCALAPPDATA\Android\Sdk\ndk" | Select-Object -Last 1
   [Environment]::SetEnvironmentVariable("NDK_HOME", $ndk.FullName, "User")
   ```
3. Targets Rust:
   ```bash
   rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
   ```
4. Gere o projeto Android: `pnpm tauri android init` (cria `src-tauri/gen/android`, que deve ser versionado).

## Desenvolvimento

```bash
pnpm install
```

```bash
pnpm tauri dev
```

```bash
pnpm tauri android dev
```

`pnpm dev` abre só o frontend no navegador (útil para iterar na UI; recursos nativos ficam indisponíveis).

### Qualidade

```bash
pnpm lint && pnpm typecheck && pnpm test
```

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml --all && cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings && cargo test --manifest-path src-tauri/Cargo.toml
```

## Estrutura

```
src/
  app/          providers, rotas, layouts (sidebar desktop / bottom-nav mobile)
  components/   ui/ (shadcn) e common/ (compartilhados)
  features/     uma pasta por feature (home, video-maker, photo-collage, settings…)
  engine/       motor de mídia em TS puro (timeline, render, decode, audio, export, collage)
  platform/     ponte tipada com o Tauri
  i18n/         pt-BR e en
src-tauri/
  src/commands  comandos expostos ao frontend
  src/services  lógica nativa (thumbnails, batidas, cache)
  src/protocol  protocolo susu:// com HTTP Range
```

Detalhes e convenções em [PLAN.md §4](PLAN.md#4-estrutura-de-pastas).

## Releases

1. Atualize o [CHANGELOG.md](CHANGELOG.md).
2. Gere a versão e a tag:
   ```bash
   pnpm version:bump 0.1.0 --tag
   ```
3. Envie:
   ```bash
   git push --follow-tags
   ```

O workflow [release.yml](.github/workflows/release.yml) gera **`.exe` (NSIS)** e **`.msi`** para Windows e o **`.apk`** para Android e publica tudo no GitHub Release da tag. Tags com sufixo (`v0.1.0-beta.1`) viram pre-release.

### Assinatura do APK

Sem configuração, o CI assina o APK com uma chave temporária (instala normalmente, mas **não atualiza por cima** de uma versão anterior). Para uma assinatura fixa, gere uma keystore uma única vez e guarde-a em local seguro:

```bash
keytool -genkeypair -v -keystore susuedition.jks -alias susuedition -keyalg RSA -keysize 2048 -validity 10000
```

Depois cadastre os secrets no repositório (Settings → Secrets and variables → Actions):

| Secret | Valor |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | conteúdo da keystore em base64 (`base64 -w0 susuedition.jks`) |
| `ANDROID_KEYSTORE_PASSWORD` | senha da keystore |
| `ANDROID_KEY_ALIAS` | `susuedition` |
| `ANDROID_KEY_PASSWORD` | senha da chave |

> ⚠️ Nunca versione a keystore. Se ela for perdida, não será possível publicar atualizações do mesmo app.

## Licença

Proprietário — todos os direitos reservados.
