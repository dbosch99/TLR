# Metodo di calcolo

## Modello della rete

Grafo diretto e ramificato con origine C.C. e primo collegamento C.C.-B.C. Ogni nodo ha un solo collegamento entrante, salvo la radice. Ogni sottostazione termina nel proprio punto SxT. Le lunghezze sono quelle di una singola tubazione; il ritorno ha stesso diametro e stessa lunghezza.

Le quote non entrano nella preselezione per perdita unitaria. Non sono ricostruiti circuiti a maglie e non è risolto un problema di bilanciamento delle pressioni.

## Potenze

Tutti i fabbisogni sono utilizzati al 100%. Per un fabbisogno complessivo strettamente positivo:

```text
P_utenze = somma dei fabbisogni delle sottostazioni [kW]
P_progetto = max(P_generatore, P_utenze) [kW]
k = P_progetto / P_utenze [-]
P_i,dimensionamento = k × P_i,fabbisogno [kW]
P_tratta = somma delle P_i,dimensionamento delle utenze a valle [kW]
```

La maggiorazione fino alla potenza del generatore è il criterio preliminare concordato, non un fattore di contemporaneità. Non si sommano due volte la potenza della tratta Sx-SxT e quella del suo ramo di alimentazione: entrambe trasportano la potenza della stessa utenza.

Se il generatore è insufficiente, il programma dimensiona sui fabbisogni completi e segnala l'insufficienza.

## Proprietà dell'acqua e portate

Il catalogo incorpora la tabella del workbook da 0 a 130 °C, con passo 1 °C. Tra due temperature vengono interpolate linearmente densità, calore specifico e viscosità cinematica. Il calore specifico è assunto alla temperatura media tra mandata e ritorno.

```text
T_ritorno = T_mandata − ΔT [°C]
T_media = (T_mandata + T_ritorno) / 2 [°C]
m_dot = P_tratta / (c_p(T_media) × ΔT) [kg/s]
Q_dot = m_dot / ρ(T) [m^3/s]
v = Q_dot / (π × D_i^2 / 4) [m/s]
Re = v × D_i / ν(T) [-]
```

Con P in kW e c_p in kJ/(kg K), la portata massica risulta in kg/s. La portata massica è la stessa in mandata e ritorno; portata volumetrica e velocità possono differire per effetto della densità.

Non viene svolta una verifica della fase dell'acqua: per temperature superiori a 100 °C la compatibilità con la pressione del circuito deve essere valutata separatamente.

## Perdite distribuite e diametro

```text
ε = rugosità assoluta del materiale [m]
D_i = diametro interno effettivo del catalogo [m]
λ = fattore d'attrito di Darcy [-]
j = λ × v^2 / (2 × g × D_i) [m c.a./m]
g = 9,81 m/s^2
j_mm = 1.000 × j [mm c.a./m]
```

Per Re <= 2.000 si usa λ = 64/Re. Per Re >= 4.000 si risolve iterativamente Colebrook-White:

```text
1 / sqrt(λ) = −2 × log10[ε / (3,7 × D_i) + 2,51 / (Re × sqrt(λ))]
```

Tra Re = 2.000 e Re = 4.000 si interpola linearmente tra il valore laminare all'estremo inferiore e quello di Colebrook all'estremo superiore. La presenza di questo regime viene segnalata.

La rugosità assoluta proviene da Dati!C3 per acciaio e acciaio preisolato e Dati!C4 per gli altri materiali, come nella logica del workbook. Si tratta di un'assunzione ereditata, non di un dato aggiornato del singolo produttore.

Si esaminano i diametri ordinati per sezione interna crescente. Si sceglie il primo per cui max(j_mandata, j_ritorno) è strettamente inferiore al limite. Il limite è espresso in mm c.a./m. Il DN è riportato come etichetta del catalogo; il calcolo usa sempre il diametro interno effettivo.

La velocità non è un criterio vincolante aggiuntivo. Se supera 2 m/s viene segnalata per consentire la valutazione del progettista.

```text
L_eff = L_reale × fattore lunghezza [m]
ΔH_tratta,M+R = (j_mandata + j_ritorno) × L_eff [m c.a.]
```

Il fattore iniziale è 1,10, modificabile. Non altera j e non altera il diametro scelto con il criterio sopra. Non sostituisce una verifica delle perdite localizzate. Il circuito critico è quello con la massima somma delle perdite distribuite di andata e ritorno lungo il percorso effettivo, senza sommare rami paralleli.

## Dispersioni termiche

I coefficienti U lineari di Supporto tubi!H sono in W/(m K), già riferiti all'unità di lunghezza della tubazione isolata: non sono coefficienti superficiali e non devono essere moltiplicati ancora per il perimetro.

```text
q_mandata = U × (T_mandata − T_ambiente) [W/m]
q_ritorno = U × (T_ritorno − T_ambiente) [W/m]
Q_mandata = q_mandata × L_eff / 1.000 [kW]
Q_ritorno = q_ritorno × L_eff / 1.000 [kW]
Q_rete = somma di tutte le Q_mandata e Q_ritorno [kW]
```

La temperatura ambiente è inizialmente 10 °C per l'interrato e 20 °C per centrale e pavimento, modificabile per ambito o per tratta. I coefficienti dei materiali generici si riferiscono all'isolamento già previsto nel workbook. Per un impianto a pavimento il risultato è lo scambio termico lineare del modello di tubo selezionato, non una verifica della resa di un sistema radiante completo.

La stima usa L_eff = L_reale × fattore lunghezza, come il calcolo delle perdite idrauliche distribuite. Il fattore si applica una sola volta nel passaggio da W/m a kW, sia in mandata sia in ritorno. Con fattore 1,10 le dispersioni sono maggiorate del 10%; i valori in W/m restano invariati. Il modello non aggiunge altri contributi di lunghezza oltre al fattore globale.

Si assumono temperature costanti lungo ciascuna tratta e lo stesso tubo per mandata e ritorno. Non si considerano raffreddamento progressivo, interazione tra i due tubi o variazione di U con le condizioni di posa. Un valore negativo indica un apporto termico dall'ambiente.

La stima delle dispersioni segue la selezione dei tubi. Non si esegue un'iterazione delle portate con le perdite termiche. Il bilancio preliminare è:

```text
P_necessaria = P_utenze + Q_rete [kW]
Margine = P_generatore − P_necessaria [kW]
```

Una tratta a potenza nulla è esclusa dalla preselezione e dalla stima termica. Se una tratta attiva non può essere dimensionata, i totali termici restano non disponibili. Questa scelta evita una somma parziale presentata come completa.

## Confronto con il workbook

Il sito riprende dati e criteri del workbook, con queste differenze dichiarate: assenza del biodigestore e del glicole, fabbisogni al 100%, proprietà dell'acqua interpolate, c_p alla temperatura media, coefficienti standard 3,7 e 2,51 di Colebrook, verifica di entrambi i percorsi, lunghezze idraulica e termica maggiorate soltanto dal fattore globale. Non è prevista l'identità numerica con tutte le formule del workbook.

## Fonti

- Workbook di riferimento: "Dimensionamento rete (invernale) - automatico.xlsm", fogli Nodi rete, Perdite idrauliche, Perdite termiche, Dati e Supporto tubi. Estrazione del 15/10/2026. Impronta SHA-256 in data/catalog.js.
- [US EPA, EPANET 2.2, algoritmi di calcolo](https://usepa.github.io/EPANET2.2/12_analysis_algorithms.html), riferimento per Darcy-Weisbach, legge laminare e trattamento dei diversi regimi. Il codice del sito usa Colebrook iterativo e l'interpolazione dichiarata sopra; non incorpora il risolutore EPANET.
