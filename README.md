# TLR · Dimensionamento reti

Calcolatore web di Davide Boschetti per reti termiche ramificate: ricostruzione delle utenze servite, ripartizione della potenza, portate, selezione automatica del diametro e perdite termiche di mandata e ritorno.

Applicazione statica, senza dipendenze JavaScript e senza compilazione. I dati di progetto rimangono nel browser; è possibile salvarli in JSON e riaprirli su altri dispositivi. Funziona su hosting statico, incluso GitHub Pages.

## Avvio sul Mac

Aprire `Avvia TLR.command`, quindi aprire nel browser l'indirizzo stampato nella finestra del Terminale. Normalmente è `http://127.0.0.1:4173/`. Lasciare aperta la finestra durante l'uso; premere Ctrl+C per terminare.

Il comando cerca Node.js nel sistema e, su questo Mac, anche nel runtime locale di Codex. Su un altro computer serve Node.js 20 o successivo. Con Node.js disponibile è sufficiente eseguire dalla cartella del progetto:

```sh
npm run dev
```

Non è necessario eseguire `npm install`. Aprire direttamente `index.html` dal Finder non è sufficiente: i moduli JavaScript richiedono il server locale oppure un hosting web.

## Utilizzo

1. Inserire potenza del generatore, mandata, ΔT e fattore di maggiorazione delle lunghezze idrauliche.
2. Inserire le tratte di sola mandata, con nodo iniziale, nodo finale e lunghezza reale in metri.
3. Compilare il fabbisogno delle sottostazioni riconosciute automaticamente. I fabbisogni sono sempre utilizzati al 100%.
4. Scegliere l'ambito delle tratte. Inizialmente i limiti sono 10 mm c.a./m per l'interrato, 30 per la centrale e 20 per il pavimento; sono criteri modificabili, non valori normativi.
5. Nella tabella dei risultati scegliere la famiglia di tubi e, se necessario, un limite specifico per la singola tratta. Lasciare il limite vuoto per usare quello dell'ambito.
6. Nella scheda "Perdite termiche" consultare dispersioni di mandata, ritorno e totale; è possibile modificare la temperatura ambiente di ogni tratta. Un campo vuoto usa la temperatura del relativo ambito.
7. Salvare il progetto in JSON oppure esportare i risultati in CSV, con separatore punto e virgola e decimali italiani.

L'esempio iniziale riprende la rete con tre sottostazioni del workbook, con generatore da 350 kW e senza biodigestore. Nella cartella `examples` sono disponibili progetti con tre e quattro sottostazioni.

## Nomenclatura e struttura

- `C.C.`: collettore interno alla centrale, origine della rete.
- `B.C.`: uscita verso la rete interrata.
- `N1`, `N2`, ecc.: nodi di diramazione.
- `S1`, `S2`, ecc.: sottostazioni.
- `S1T`, `S2T`, ecc.: punti terminali delle rispettive sottostazioni.

La prima tratta è `C.C.-B.C.`. Ogni sottostazione deve avere la sua tratta terminale, per esempio `S1-S1T`, con lunghezza di sola mandata. Se sono previsti 15 m complessivi di mandata e ritorno, inserire 7,5 m.

Le diramazioni sono dedotte dai collegamenti, senza dipendere dall'ordine delle righe. Sono ammesse solo reti ramificate con un unico percorso dalla centrale a ciascun terminale. Vengono segnalati collegamenti duplicati, nodi scollegati, terminali errati e maglie. I numeri dei nodi non richiedono una sequenza continua, ma non possono avere zeri iniziali. Le sigle possono essere scritte in minuscolo: vengono normalizzate.

## Calcoli e limiti del modello

Il metodo completo è descritto in [docs/METODO.md](docs/METODO.md) e nella finestra "Metodo di calcolo" del sito.

- Potenza di progetto uguale al maggiore tra potenza del generatore e somma dei fabbisogni. L'eventuale maggiorazione viene ripartita in proporzione ai fabbisogni.
- Acqua senza glicole; proprietà interpolate dalle tabelle del workbook. Mandata e ritorno tra 0 e 130 °C.
- Minimo diametro interno di catalogo con perdita unitaria strettamente inferiore al limite sia in mandata sia in ritorno. Stesso tubo sui due percorsi.
- Perdite distribuite con Darcy-Weisbach; Colebrook-White nel campo turbolento, legge laminare e interpolazione nel campo di transizione.
- Dispersioni stimate con U lineare e lunghezze reali, assumendo temperature dell'acqua costanti lungo le tratte. Sono escluse l'interazione termica tra i tubi e l'iterazione tra dispersioni e portate.
- Il margine termico confronta il generatore con la somma dei fabbisogni delle utenze e delle dispersioni. Non è un bilancio energetico finale della rete.
- Valvole, raccordi, scambiatori, quote e verifiche della pressione non sono modellati. Le perdite del circuito critico sono esclusivamente distribuite e non rappresentano la prevalenza finale della pompa.
- Una tratta a potenza nulla non viene dimensionata ed è esclusa dalla stima termica. Se un diametro non è disponibile, il totale delle dispersioni e il margine termico restano non disponibili, evitando di presentare una somma parziale come completa.

I cataloghi contengono 14 famiglie e 157 diametri, estratti dal workbook di riferimento il 15/10/2026. I dati dei produttori non vengono aggiornati automaticamente. La preselezione idraulica non verifica pressione e temperatura ammissibili del prodotto.

## GitHub Pages

Il progetto è pronto per essere caricato in un repository GitHub, per esempio `TLR`. Non richiede servizi esterni, variabili segrete o processi di compilazione.

1. Caricare il contenuto di questa cartella nel repository, mantenendo `index.html` nella radice.
2. Nel repository aprire **Settings > Pages**.
3. In **Build and deployment**, scegliere **Deploy from a branch**.
4. Selezionare il branch `main` e la cartella **/ (root)**, quindi salvare.
5. Attendere il completamento della pubblicazione. Se il repository si chiama `TLR`, l'indirizzo previsto è `https://dbosch99.github.io/TLR/`.

Tutti i percorsi delle risorse sono relativi e funzionano anche sotto `/TLR/`. Il file `.nojekyll` evita l'elaborazione Jekyll. Il progetto locale non contiene credenziali e non viene pubblicato automaticamente.

Riferimento: [creare un sito GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).

## Verifica dei calcoli

```sh
npm test
```

I test usano il runner integrato in Node.js. Comprendono ripartizione e conservazione delle potenze, aggiunta e rimozione di nodi, ordinamento delle righe, controllo del minimo diametro, confronto di Colebrook con un valore indipendente, somma delle dispersioni, modifica dell'isolamento e dei criteri, dati non validi e salvataggio dei progetti.

## Struttura del progetto

- `index.html`, `styles.css`: interfaccia e impaginazione adattiva.
- `src/app.js`: interazioni, disegno della rete, salvataggio e CSV.
- `src/model.js`: formato del progetto, esempi e importazione.
- `src/network.js`: validazione della rete e riconoscimento delle utenze a valle.
- `src/physics.js`: calcoli idraulici, scelta dei diametri e dispersioni.
- `data/catalog.js`: cataloghi e proprietà dell'acqua estratti dal workbook.
- `scripts/serve.mjs`: server locale senza dipendenze.
- `scripts/import-excel.py`: estrazione in sola lettura dal file Excel, utile solo per aggiornare i dati incorporati; richiede Python e openpyxl.
- `tests/calculation.test.js`: controlli automatici del motore di calcolo.
- `examples`: progetti JSON riapribili dal sito.

Per aggiornare i dati di riferimento:

```sh
python3 scripts/import-excel.py "/percorso/del/file.xlsm"
```

Lo script non salva e non modifica il workbook. Nel catalogo generato sono registrati il nome e l'impronta SHA-256 del file di origine. Dopo un aggiornamento del catalogo occorre ripetere i test e controllare la compatibilità dei progetti esistenti.
