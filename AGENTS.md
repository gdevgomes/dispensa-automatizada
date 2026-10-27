# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Projeto

## Visão geral

Dispensa Automatizada é um app mobile (Android e iOS) que controla os alimentos guardados em casa. O usuário escaneia o código de barras do produto, informa a validade e recebe lembretes para consumir antes de vencer. O app também lê o QR Code de NFC-e para importar produtos de uma nota fiscal. A identidade visual está em `MARCA.md`.

## Stack

- Expo SDK 57, React Native 0.86, React 19 e TypeScript.
- Expo Router com rotas por arquivo (`typedRoutes` e React Compiler ativos).
- Persistência local com AsyncStorage. Não há backend.
- Notificações locais com `expo-notifications` e `expo-task-manager`.
- Câmera e leitura de código com `expo-camera`. A NFC-e abre em `react-native-webview`.
- Build com EAS (`eas.json`). Perfis: `preview` (APK interno) e `production`.
- Pacote Android e bundle iOS: `com.devlogicasolucoes.dispensaautomatizada`.

## Estrutura

- `src/app/`: telas e rotas (`_layout.tsx`, `index.tsx`, `list.tsx`).
- `src/components/`: componentes de interface (scanner, modal da NFC-e, toast, tabs).
- `src/constants/theme.ts`: paleta e tema.
- `src/hooks/`: hooks de tema e esquema de cores.
- `src/lib/`: regras de negócio e dados.
  - `pantry-storage.ts` e `shopping-list-storage.ts`: armazenamento dos itens.
  - `barcode-lookup.ts`: consulta de produto pelo código de barras.
  - `nfce.ts` e `nfce-scrape.ts`: leitura e extração de dados da NFC-e.
  - `expiry.ts`: cálculo e formatação de validade.
  - `notifications.ts`: lembretes de consumo e de inatividade.
- `assets/`: ícones, splash e imagens.
- `android/` e `ios/`: projetos nativos gerados.

## Comportamentos importantes

- Lembrete de consumo: chega 7 dias antes da validade, às 9h. Tem os botões "Sim, já consumi" e "Ainda tenho".
- Os botões rodam em segundo plano (`opensAppToForeground: false`) e fecham a notificação. `handleReminderResponse` guarda a última resposta tratada para não aplicá-la duas vezes.
- Lembrete de inatividade: 15 dias depois de fechar o app.
- Variável `EXPO_PUBLIC_TEST_REMINDERS=true` ativa o modo de teste: 1 segundo por mês até a validade e inatividade em 15 segundos. O valor entra no build. O perfil `preview` liga o modo e o `production` desliga.

## Comandos

- `npm start`: inicia o servidor do Expo.
- `npm run lint`: roda o ESLint.
- `npx tsc --noEmit`: verifica os tipos. O `tsconfig.json` não define `noEmit`, então sempre passe a flag.

## Regras de trabalho

- Não rode o app (`expo run:android`, `expo run:ios`, emuladores ou dev builds). Só edite o código e rode `tsc` e lint.
- Escreva textos de interface e comentários em português, com acentos.
