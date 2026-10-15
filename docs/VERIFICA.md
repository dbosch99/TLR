# Verifiche della prima versione

Data: 15/10/2026.

Sono stati eseguiti con esito positivo 18 test automatici del motore di calcolo. Sono state inoltre confrontate con il workbook tutte le 157 coppie diametro/coefficienti termici incorporate. Una verifica numerica indipendente in Python ha risolto Colebrook per bisezione su tutte le tubazioni dell'esempio e ricalcolato separatamente le dispersioni.

Nel browser sono stati provati: modifica della potenza del generatore, segnalazione dell'insufficienza, cambio di isolamento e temperatura ambiente, variazione del fattore lunghezza con aggiornamento delle perdite idrauliche, delle dispersioni e del margine termico, criterio di perdita non valido e successiva correzione, aggiunta del nodo N2 e della sottostazione S4, rimozione delle nuove tratte, nuovo progetto e annullamento, salvataggio JSON, riapertura JSON, recupero automatico dopo ricaricamento ed esportazione CSV.

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

Dispersioni complessive con fattore lunghezza 1,10: 38,880888544 kW. Potenza richiesta: 248,441016346 kW. Margine termico: +101,558983654 kW.

Circuito critico: S3, con 12,803200671 m c.a. di sole perdite distribuite di mandata e ritorno. Questi valori si riferiscono al modello e alle famiglie predefinite, non sono un confronto diretto con il dimensionamento completo in Excel.

## Ambito della verifica

Le prove confermano il funzionamento della prima versione locale e dei calcoli descritti in METODO.md. Il 15/10/2026 è stato pubblicato il sito https://dbosch99.github.io/TLR/ tramite GitHub Pages, branch main e cartella radice. La pubblicazione è terminata con stato built. Nel sito pubblico sono stati verificati il caricamento dei cataloghi e dei risultati, la selezione della scheda Perdite termiche e il ricalcolo automatico variando la potenza del generatore da 350 a 400 kW e ripristinando 350 kW. Alla prima pubblicazione le dispersioni erano 35,346 kW e il margine 105,09 kW; questi valori precedono la correzione del fattore lunghezza descritta sotto.

Non sono state eseguite prove su dispositivi fisici Windows o iPhone. Non è stata eseguita una verifica idraulica completa con perdite localizzate o una verifica termica con raffreddamento progressivo.

## Correzione del fattore lunghezza del 15/10/2026

Il passaggio da W/m a kW usa ora la lunghezza reale moltiplicata per il fattore impostato, sia per la mandata sia per il ritorno. Il fattore si applica una sola volta e non modifica i valori in W/m. Sono stati aggiornati le indicazioni dell'interfaccia, la formula nel metodo di calcolo e l'intestazione CSV della lunghezza di calcolo.

Tutti i 16 test sono stati rieseguiti con esito positivo. Il controllo di regressione confronta fattori 1,00, 1,10 e 1,30: le dispersioni e le perdite idrauliche scalano proporzionalmente, il margine si aggiorna e i DN e i W/m restano invariati. Nell'esempio con fattore 1,10 le dispersioni di mandata sono 22,448728633 kW e quelle di ritorno 16,432159912 kW. Con fattore 1,30 il totale è 45,950141007 kW e il margine +94,489731191 kW.

## Allineamento idraulico all'Excel e gestione dei limiti

Il 15/10/2026 il sito è stato allineato alla funzione VBA TLR_Attrito e alle formule delle portate del workbook: LOOKUP delle proprietà dell'acqua, c_p separato a mandata e ritorno, soglia Re = 2.300 e costanti 3,71 e 2,50 di Colebrook. Il test di riferimento confronta portate volumetriche, velocità, coefficienti f e perdite unitarie per tutte le 16 righe del foglio Perdite idrauliche, a 242 kW e 85/65 °C, con tolleranza relativa 10^-7.

Tutti i 18 test passano. Sono coperti i cataloghi insufficienti delle cinque famiglie segnalate, la selezione del diametro massimo, l'aumento del limite al centesimo superiore, il ritorno al criterio iniziale cambiando tubo e la conservazione dei limiti richiesti nei progetti salvati. Criteri non validi continuano a rendere non disponibili i totali dipendenti.

Nel browser locale, con 242 kW, il rame sulla tratta C.C.-B.C. viene selezionato con DN 42, perdita massima 138,31 mm c.a./m e limite automatico 138,32 mm c.a./m, entrambi rossi. Nella tratta B.C.-S1 i limiti manuali 20, 5 e 10 sono rispettivamente rosso, nero e nero rispetto al criterio interrato di 10 mm c.a./m. Il CSV scaricato conserva tutti i risultati delle 8 tratte, limite applicato e richiesto, criterio per ambito, portate massiche e coefficienti f di mandata e ritorno. Nessun errore JavaScript rilevato durante la prova.
