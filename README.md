# Scale Up Hub

Crie uma aplicação web de uma página chamada "Image Link Generator" com as seguintes funcionalidades:

Funcionalidade principal: O usuário arrasta ou clica para selecionar uma imagem (PNG, JPG, GIF, WEBP), a aplicação faz upload dessa imagem para o Cloudinary usando um preset público anônimo, e retorna um link curto e direto para a imagem (ex: https://res.cloudinary.com/...).

Interface:

Área de drag & drop centralizada com ícone e texto "Arraste a imagem aqui ou clique para selecionar"

Preview da imagem após seleção

Barra de progresso durante o upload

Campo com o link gerado, fácil de copiar com um clique

Botão "Copiar link" com feedback visual (ex: "Copiado!")

Botão "Abrir imagem" que abre o link em nova aba

Opções de formato de saída: URL direta, Markdown, HTML, Prompt IA

Botão "Nova imagem" para resetar

Técnico:

Use React + Tailwind

Upload via Cloudinary API: POST https://api.cloudinary.com/v1_1/SEU_CLOUD_NAME/image/upload com FormData contendo file e upload_preset

O Cloudinary name e o upload preset devem ser configuráveis via variáveis de ambiente .env: VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_UPLOAD_PRESET

Tratar erros de upload com mensagem clara para o usuário

Design limpo, moderno, responsivo

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://feramentasdo00duhot.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/03560931-5f6a-41e1-a222-0510d1828a23).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
