# pitaya-book-api

## Rappels de galerie

Appliquer les migrations Drizzle avant de déployer une version de l’API qui utilise les contacts et rappels. Le service vérifie les galeries à échéance au démarrage, après la création ou la modification d’un rappel, puis toutes les dix secondes. Il doit rester en cours d’exécution pour envoyer les rappels à l’heure prévue. La migration conserve les anciens réglages dans un rappel indépendant.

En production, configurer `FRONTEND_URL`, `SMTP_SERVER`, `SMTP_PORT`, `SMTP_USERNAME` et `SMTP_PASSWORD`. `SMTP_FROM` permet de choisir l’expéditeur ; par défaut, l’adresse du site est utilisée. `GALLERY_CONTACT_EMAIL` définit l’adresse à laquelle le client peut demander une prolongation. La variable `GALLERY_REMINDERS_ENABLED=false` désactive explicitement les envois. En développement local, les rappels ne sont pas exécutés, sauf avec `GALLERY_REMINDERS_ENABLED=true`.

Chaque galerie peut avoir plusieurs rappels, chacun avec son délai et ses propres destinataires. Les e-mails ne sont envoyés qu’aux contacts sélectionnés qui n’ont pas désactivé les rappels. La notification d’administration est créée pour chaque rappel, indépendamment de l’envoi de l’e-mail.
