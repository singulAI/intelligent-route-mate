

# Plano: Portal público de 36 linhas + painel de gestão

Vou transformar o app em um portal público de transporte urbano com 36 cards de linhas. A landing page fica aberta para qualquer cidadão; o gestor entra discretamente por atalho de teclado e pode cadastrar/atualizar todo o conteúdo (textos, imagens, vídeos, voz, notificações). Os dados — incluindo mídia — vão para um backend real (Lovable Cloud), porque o localStorage não comporta arquivos.

## O que muda para o usuário

**Landing page pública (`/`)**
- Grid responsivo com **36 cards** de linhas de ônibus
- Cada card mostra: número da linha, nome, mini-mapa estático com a polilinha da rota e badge de status
- Cards sem dados ainda exibem **"Em breve — nova rota será carregada"** com visual placeholder elegante
- Cards preenchidos são clicáveis e abrem a página de detalhe pública
- Acesso ao gestor: **atalho `Ctrl+Shift+G`** abre modal de senha (sem botão visível)

**Página pública da linha (`/linha/$numero`)**
- Mapa expandido com a rota completa
- Cabeçalho com nome, número, tarifa, vigência, consórcio, delegatária
- Galeria de imagens, player de vídeo embutido (URL externa)
- Lista de orientações de cada waypoint (texto + botão "ouvir" usando voz)
- Quadro de horários, frota por faixa horária
- Notificações ativas em destaque (alertas, mudanças de itinerário)

**Painel de gestão (`/gestor`, protegido por login)**
- Login email/senha (Lovable Cloud Auth)
- Lista das 36 linhas com status (publicada / rascunho / vazia)
- Editor por linha com abas:
  - **Identidade**: número, nome, descrição, tarifa, consórcio, delegatária, vigência
  - **Rota**: mapa editável com waypoints (mantém o que já existe)
  - **Mídia**: upload de imagens e capa (Storage); URLs de vídeo
  - **Orientações de voz**: texto por waypoint, falado em pt-BR
  - **Horários e frota**: tabelas dia útil / sábado / férias / atípico
  - **Notificações**: criar/atualizar/remover avisos com data e prioridade
- **Importação em lote**: aceita `.json` (formato atual) e `.csv` (template baixável)
- Publicar / despublicar linha

**Modo Motorista (`/motorista`)**
- Mantido como está (cockpit com voz e telemetria), agora lendo do backend
- Adicionado seletor de linha entre as 36

## Arquitetura técnica

**Backend**: Lovable Cloud (Supabase). Necessário para storage de mídia, auth de gestor e dados sincronizados entre dispositivos.

**Esquema do banco**:
- `lines` — `id`, `number` (1-36, único), `name`, `description`, `fare`, `consortium`, `delegatary`, `validity_date`, `cover_image_url`, `published` (bool), `created_at`, `updated_at`
- `waypoints` — `id`, `line_id`, `position`, `lat`, `lng`, `instruction`, `maneuver_type`, `suggested_gear`, `max_speed`, `observation`
- `media` — `id`, `line_id`, `type` ('image' | 'video'), `url`, `caption`, `position`
- `notifications` — `id`, `line_id` (nullable = global), `title`, `message`, `priority` ('info'|'warning'|'critical'), `active`, `starts_at`, `ends_at`
- `schedules` — `id`, `line_id`, `day_type` ('util'|'sabado'|'ferias'|'atipico'), `departures` (jsonb), `fleet_per_hour` (jsonb)
- `user_roles` — tabela separada com enum `app_role` ('admin') e função `has_role()` (security definer)

**RLS**:
- Public SELECT em `lines` (apenas `published=true`), `waypoints`, `media`, `notifications`, `schedules`
- INSERT/UPDATE/DELETE restrito a `has_role(auth.uid(), 'admin')`
- Storage bucket `line-media` (público para leitura, upload restrito a admin)

**Acesso do gestor**:
1. Atalho `Ctrl+Shift+G` em qualquer página dispara modal de login
2. Login email/senha (Lovable Cloud Auth — auto-confirm ativo para simplicidade)
3. Após autenticar, valida role `admin` em `user_roles`. Se não tiver, mostra "acesso negado"
4. Primeiro admin é criado por seed (email/senha definidos via secret)

**Importação CSV**:
- Template com colunas: `line_number,waypoint_position,lat,lng,instruction,maneuver,gear,max_speed,observation`
- Parser usa PapaParse no cliente
- JSON mantém formato atual (manifesto + rotas)

**Mini-mapas nos cards**:
- Renderização leve com Leaflet sem tiles interativos (só polilinha sobre fundo simples) OU SVG estático calculado das coordenadas
- Decisão: SVG estático (mais leve para 36 cards simultâneos)

**Páginas/rotas TanStack**:
- `/` — landing com grid de 36 cards
- `/linha/$numero` — detalhe público
- `/gestor` — painel admin (protegido)
- `/gestor/$lineId` — editor de linha
- `/motorista` — cockpit (mantido)

**Migração de dados**: a Linha 474 atual (em localStorage) será inserida via seed no banco como linha número 474 publicada.

## Etapas de implementação

```text
1. Habilitar Lovable Cloud + criar tabelas, RLS e bucket
2. Seed: 36 linhas (placeholders) + Linha 474 com dados reais + 1 admin
3. Reescrever / e criar /linha/$numero (público)
4. Modal de login global ativado por Ctrl+Shift+G
5. Reescrever /gestor com abas (identidade, rota, mídia, voz, horários, notificações)
6. Importação JSON + CSV (PapaParse)
7. Adaptar /motorista para ler do backend e seletor de linha
8. QA: testar fluxo público e gestor
```

## Confirmações importantes

- Você confirmou **backend** para mídia → vou habilitar **Lovable Cloud** (necessário, sem alternativa viável para imagens/vídeos persistentes)
- Vou criar um **admin inicial** no seed. Por favor, defina email e senha quando aprovar (ou uso `admin@racontagem.local` / senha gerada que mostro uma vez)
- As 36 linhas começam vazias com mensagem "Em breve" e o gestor preenche por ordem real

