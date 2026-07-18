# Reinstalar a app no iPhone (sem Claude Code)

O sideload gratuito da Apple expira **de 7 em 7 dias**. Quando a app deixar de abrir,
reinstala assim — demora ~3 minutos.

## Antes de começar
- Liga o iPhone ao Mac **por cabo** (mais fiável que Wi-Fi).
- Desbloqueia o iPhone e, se perguntar, toca em **Confiar neste computador**.

## Opção 1 — Pelo Terminal (mais rápido)

Abre a app **Terminal** e cola isto, linha a linha:

```sh
cd ~/Desktop/what-should-i-do-next

# 1. Reconstruir o site + sincronizar para o iOS
GIT_CONFIG_COUNT=0 npm run ios:sync

# 2. Ver o ID do iPhone (copia o código comprido tipo 1B05D65E-....)
xcrun devicectl list devices | grep -i iphone

# 3. Compilar + assinar (troca o ID se for diferente do de baixo)
cd ~/Desktop/what-should-i-do-next/ios/App
GIT_CONFIG_COUNT=0 xcodebuild -project App.xcodeproj -scheme App -configuration Debug \
  -destination 'id=1B05D65E-389A-58D9-9A5E-9A3134A56D90' \
  -allowProvisioningUpdates build

# 4. Instalar no telemóvel
xcrun devicectl device install app --device 1B05D65E-389A-58D9-9A5E-9A3134A56D90 \
  "$HOME/Library/Developer/Xcode/DerivedData/App-bmvpqlfbrdeqdpahtlkghxamsktg/Build/Products/Debug-iphoneos/App.app"
```

> Se a pasta `App-bmvpqlfbrdeqdpahtlkghxamsktg` tiver mudado de nome, corre:
> `ls ~/Library/Developer/Xcode/DerivedData/ | grep App`
> e usa a que aparecer.

> Se o passo 4 der **"Connection reset by peer"**, corre o passo 4 outra vez — costuma
> funcionar à segunda.

## Opção 2 — Pelo Xcode (se preferes clicar)

1. Abre o **Xcode**.
2. Menu **File → Open** → `~/Desktop/what-should-i-do-next/ios/App/App.xcodeproj`.
3. No topo, ao lado do nome "App", escolhe o **iPhone da Mariana**.
4. Carrega no botão **▶ (Run)** e espera.

## No iPhone (só na 1ª vez após reinstalar)

Se a app não abrir e disser "developer não fidedigno":
**Definições → Geral → VPN e Gestão de Dispositivos → Apple Development: marianalameiro.03@gmail.com → Confiar.**

---

Os teus dados **não se perdem** ao reinstalar — estão guardados na conta (Supabase) e voltam
com o login. A app válida por mais 7 dias a cada reinstalação.
