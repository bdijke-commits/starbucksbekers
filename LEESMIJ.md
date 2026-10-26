# Mijn Bekerkast: installeren

Een app die je op je telefoon en laptop kunt installeren. Jij logt in en bewerkt; bezoekers kijken mee en kunnen bij een beker reageren, zonder account. De app werkt ook zonder internet.

Je hebt twee gratis accounts nodig: **Firebase** (voor inloggen en opslag) en **GitHub** (om de app online te zetten). Reken op ongeveer 30 minuten.

---

## 1. Firebase-project maken

1. Ga naar https://console.firebase.google.com en log in met een Google-account.
2. Klik op **Project maken**, geef het een naam (bijv. `bekerkast`) en zet Google Analytics uit.
3. Klik op het **</>**-icoon (web-app toevoegen), geef de app een naam en klik op **App registreren**. Firebase Hosting hoef je niet aan te vinken.
4. ✓ Al gedaan: `config.js` is ingevuld voor jouw project, met `bdijke@gmail.com` als inlogadres.

## 2. Inloggen aanzetten

1. Ga in Firebase naar **Build > Authentication** en klik op **Aan de slag**.
2. Zet onder **Aanmeldmethode** twee methoden aan:
   - **E-mailadres/wachtwoord** (voor jou)
   - **Anoniem** (zodat bezoekers zonder account kunnen reageren)
3. Ga naar het tabblad **Gebruikers** > **Gebruiker toevoegen** en maak jezelf aan met `bdijke@gmail.com` en een sterk wachtwoord.

## 3. Database aanmaken

1. Ga naar **Build > Firestore Database** > **Database maken**.
2. Kies een locatie in Europa (bijv. `eur3`) en start in **productiemodus**.
3. Open het tabblad **Regels**. Vervang alles wat er staat door de volledige inhoud van `firestore.rules` (je e-mailadres staat er al in).
4. Klik op **Publiceren**.

## 4. Online zetten met GitHub Pages

1. Maak een account op https://github.com (als je dat nog niet hebt).
2. Klik op **New repository**, noem hem `bekerkast`, kies **Public** en klik op **Create repository**.
3. Klik op **uploading an existing file**. Sleep alle bestanden uit deze map erin (er zitten geen submappen in). Klik op **Commit changes**.
4. Ga naar **Settings > Pages**. Kies bij *Branch* `main` en `/ (root)` en klik op **Save**.
5. Na een minuut of twee staat de app op `https://JOUWNAAM.github.io/bekerkast/`.

## 5. Firebase vertellen waar de app staat

Ga in Firebase naar **Authentication > Instellingen > Geautoriseerde domeinen** en voeg `JOUWNAAM.github.io` toe. Zonder deze stap kun je niet inloggen.

## 6. Je collectie overzetten

Open de app, klik op **Inloggen** en log in. Je ziet dan de knop **Collectie overzetten**. Die zet de 79 bekers en 4 notities uit de Claude-versie in je nieuwe database. Dat hoeft maar één keer.

## 7. Op je telefoon installeren

- **iPhone (Safari):** open de link, tik op het deelicoon en kies **Zet op beginscherm**.
- **Android (Chrome):** open de link en kies **App installeren** in het menu.

Deel de link gewoon met anderen. Zij zien je collectie en kunnen reageren; alleen jij kunt na inloggen bewerken.

---

## Goed om te weten

- **Wie kan wat?** Iedereen met de link ziet wat er in je kast staat en wat je zoekt, en kan reageren. Jouw notities zijn alleen voor jou zichtbaar. Reacties kun jij verwijderen; een bezoeker kan alleen de eigen reactie verwijderen.
- **De apiKey in config.js is niet geheim.** Dat is bij Firebase normaal: de beveiliging zit in de regels uit stap 3.
- **Eigen foto's** worden verkleind opgeslagen in de database. Dat past ruim binnen het gratis plan.
- **Iets aangepast aan de bestanden?** Verhoog dan in `sw.js` het versienummer (`bekerkast-v1` → `bekerkast-v2`), anders blijven telefoons de oude versie tonen.
- **Foto's:** de mokfoto's komen van starbucks-mugs.com en, voor de Icon-serie, uit eBay-advertenties. De app staat openbaar online, dus deel de link liever met bekenden dan op social media.
- **Lijst bijwerken:** nieuwe bekers op starbucks-mugs.com komen er niet vanzelf bij. `data.json` en de map `s` kunnen opnieuw gemaakt worden; je vinkjes blijven dan bewaard.
