# CarCostCompare

Comparateur de coût d'usage de voitures (Angular 22 + API Express + MongoDB).

## Déploiement (Docker)

Prérequis : Docker avec Compose (`docker compose` ou `docker-compose`).

```bash
git clone <url-du-repo> CarCostCompare
cd CarCostCompare
cp .env.example .env   # optionnel : port, interface, nom de base
docker compose up -d --build
```

L'application (Angular + `/api`) est servie sur `http://<serveur>:8080`. MongoDB n'est pas exposé ; ses données vivent dans le volume `mongo-data`.

- Derrière un reverse proxy sur la même machine : `APP_BIND=127.0.0.1` dans `.env`, puis proxifier vers `127.0.0.1:${APP_PORT}`. Aucune authentification n'est gérée par l'app.
- Mise à jour : `git pull && docker compose up -d --build`.
- Sauvegarde : `docker compose exec mongo mongodump --archive --db carcost > backup.archive`.
- Restauration : `docker compose exec -T mongo mongorestore --archive < backup.archive`.

## Développement

```bash
npm install
docker run -d --name carcost-mongo -p 27017:27017 mongo:8
npm run start:api   # API sur :3000
npm start           # Angular sur :4200, /api proxifié vers :3000
```
