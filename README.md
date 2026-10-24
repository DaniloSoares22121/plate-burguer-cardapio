# Plate Burguer — cardápio digital

Cardápio digital da Plate Burguer (https://plateburguer.brixly.com.br), feito na [Brixly](https://brixly.com.br).

- Cardápio com sacola e pedido pelo WhatsApp (`src/menu`)
- Painel do restaurante em `/admin` (`src/admin`): produtos, categorias, pedidos e a aba WhatsApp (atendente AtendeAI)

## Rodar

```bash
npm install
npm run dev
```

O login e o banco ficam no servidor da Brixly (rotas `/_api/*`), então o painel só funciona publicado lá.
