# Verifiche della prima versione

Data: 15/10/2026.

Sono stati eseguiti con esito positivo 16 test automatici del motore di calcolo. Sono state inoltre confrontate con il workbook tutte le 157 coppie diametro/coefficienti termici incorporate. Una verifica numerica indipendente in Python ha risolto Colebrook per bisezione su tutte le tubazioni dell'esempio e ricalcolato separatamente le dispersioni.

Nel browser sono stati provati: modifica della potenza del generatore, segnalazione dell'insufficienza, cambio di isolamento e temperatura ambiente, variazione della lunghezza idraulica senza alterazione delle dispersioni, criterio di perdita non valido e successiva correzione, aggiunta del nodo N2 e della sottostazione S4, rimozione delle nuove tratte, nuovo progetto e annullamento, salvataggio JSON, riapertura JSON, recupero automatico dopo ricaricamento ed esportazione CSV.

Il CSV scaricato dopo aver riaperto il progetto con quattro sottostazioni è stato controllato: 11 tratte, limiti rispettati e somma delle dispersioni di mandata e ritorno coerente.

L'interfaccia è stata controllata nel browser integrato su dimensioni desktop e telefono. È stato corretto un elemento nascosto che produceva scorrimento orizzontale della pagina: le tabelle e il diagramma scorrono nei propri riquadri. Non sono stati osservati errori JavaScript nella console durante le prove.

## Risultati di riferimento

Esempio incorporato con tre sottostazioni, generatore da 350 kW, mandata 85 °C, ritorno 65 °C, fattore lunghezza 1,10 e criteri predefiniti:

| Tratta | DN selezionato |
| --- | ---: |
| C.C.-B.C. | 65 |
| B.C.-S1 | 50 |
| S1-S1T | 32 |
| B.C.-N1 | 80 |
| N1-S2 | 40 |
| S2-S2T | 25 |
| N1-S3 | 80 |
| S3-S3T | 65 |

Dispersioni complessive: 35,346262313 kW.

Circuito critico: S3, con 12,817555569 m c.a. di sole perdite distribuite di mandata e ritorno. Questi valori si riferiscono al modello e alle famiglie predefinite, non sono un confronto diretto con il dimensionamento completo in Excel.

## Ambito della verifica

Le prove confermano il funzionamento della prima versione locale e dei calcoli descritti in METODO.md. Il 15/10/2026 è stato pubblicato il sito https://dbosch99.github.io/TLR/ tramite GitHub Pages, branch main e cartella radice. La pubblicazione è terminata con stato built. Nel sito pubblico sono stati verificati il caricamento dei cataloghi e dei risultati, la selezione della scheda Perdite termiche e il ricalcolo automatico variando la potenza del generatore da 350 a 400 kW e ripristinando 350 kW. Le dispersioni iniziali sono 35,346 kW e il margine termico 105,09 kW, coerenti con la versione locale.

Non sono state eseguite prove su dispositivi fisici Windows o iPhone. Non è stata eseguita una verifica idraulica completa con perdite localizzate o una verifica termica con raffreddamento progressivo.
