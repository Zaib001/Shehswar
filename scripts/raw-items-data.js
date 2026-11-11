// Raw lines extracted from the 21 pages of CodesAP Subform / Master Item Register (632 total records)
const rawPages = [
  // Page 1: 01 Bags, labels, pouches, sachets & stickers (28 items)
  `SECTION: 01 Bags, labels, pouches, sachets & stickers
Acetamaprod	200.00	Nos	1	—	Insecticides	PM	15-Aug-18 12:37:22 PM
Bag Bentonic	8.00	kg	1	—	Insecticides	PM	14-Oct-24 3:01:34 PM
Bag BOP	50.00	Nos	1	—	Insecticides	PM	16-Mar-21 11:49:13 AM
Bag Carbofuran	8.00	Nos	1	—	Others	PM	25-Feb-15 12:00:17 PM
Bag Cartap	9.00	Nos	1	—	—	PM	11-May-15 2:26:48 PM
Bag Cotton Seed 10kg	10.00	kg	1	—	Seeds	PM	16-Apr-17 12:33:12 PM
Bag Elegent Plus (Potash 50%)	10.00	Nos	1	—	—	PM	28-Nov-16 1:21:41 PM
Bag Elegent Plus SOP	25.00	kg	1	—	Others	PM	02-Oct-23 12:29:50 PM
Bag Elegent Process Charges	10.00	Nos	1	—	—	PM	04-Dec-16 3:15:59 PM
Bag Fipronil 6Kg	6.00	Nos	1	—	Insecticides	PM	14-Mar-16 12:44:47 PM
Bag MAP	10.00	Nos	1	—	Others	PM	16-Mar-21 11:49:08 AM
Bag Monomehypo	7.00	Nos	1	—	—	PM	24-May-15 9:50:50 AM
Bag Monomehypo (2bl) (SP)	7.00	Nos	1	—	—	PM	16-May-16 2:50:07 PM
Bag Nectrown 20Kg	20.00	kg	1	—	—	PM	08-May-16 4:27:29 PM
Bag Nectrown 8Kg	8.00	kg	1	—	—	PM	08-May-16 4:27:14 PM
Bag Nelegant	5.00	kg	1	—	Seeds	PM	16-Mar-21 11:48:45 AM
Bag Nelichlo	4.00	kg	1	—	Seeds	PM	16-Oct-24 3:43:07 PM
Bag NP	50.00	kg	1	—	—	PM	16-Mar-21 11:49:14 AM
Bag Pearl Millet 1.5/kg	1.50	Nos	1	—	—	PM	14-Jun-16 9:56:54 AM
Bag Peddy Seed	10.00	Nos	1	—	Seeds	PM	28-May-17 11:10:59 AM
Bag Sheridan	4.00	kg	1	—	Others	PM	08-Dec-21 3:40:27 PM
Bag Sheridan	4.00	kg	1	—	—	PM	03-Apr-23 9:35:31 AM
Bag Sorghum Sodan	1.00	Nos	1	—	—	PM	29-Jan-17 10:32:01 PM
Bag Sulfosulforan	13.50	Nos	1	—	Others	PM	25-Feb-15 12:00:31 PM
Bag Sulphar	25.00	kg	1	—	—	PM	24-Mar-25 12:35:32 PM
Bag Super Sher	4.00	Nos	1	—	Others	PM	25-Feb-15 11:59:47 AM
Bag Super Sher	10.00	kg	1	—	PGR's/Nutrients	PM	29-Jan-17 10:21:05 PM
Bags	50.00	Nos	1	—	—	PM	19-Apr-16 11:25:19 AM`,

  // Page 2 (32 items)
  `Bags	25.00	Nos	1	—	—	PM	19-Apr-16 11:25:27 AM
Bags Breeda (Trimbl&Wantury)	3.00	kg	1	—	—	PM	16-Mar-25 10:56:54 AM
Bags Carbofuran 3G	8.00	Nos	1	—	Insecticides	PM	24-Feb-15 4:01:05 PM
Bags Euro Phos	10.00	Nos	1	—	Others	PM	08-Dec-21 3:33:10 PM
Bags Isoproturon	800.00	Nos	1	—	—	PM	28-Feb-15 12:02:20 PM
Bags MAGSUL	4.00	kg	1	—	—	PM	16-Mar-25 10:57:14 AM
Bags Nectar Shining	5.00	Nos	1	—	Others	PM	24-Feb-15 4:01:09 PM
Bags Sulfo-K	25.00	kg	1	—	—	PM	12-Mar-23 11:40:08 AM
Box Gibron	1.00	Nos	1	—	—	PM	14-Oct-24 3:16:12 PM
Box Metro	4.00	Nos	1	—	Soil Applicant	PM	24-Feb-15 4:01:13 PM
Brushier super sher	4.00	Nos	1	—	Others	PM	24-Feb-15 4:01:15 PM
Can	20.00	ltr	1	—	—	PM	01-Apr-15 11:04:09 AM
Cane White 4ltr	4.00	Nos	1	—	—	PM	05-Jul-15 10:06:39 AM
Carton	1.00	Nos	1	—	Raw material	PM	24-Feb-15 4:01:18 PM
Carton Carbofuran	1.00	Nos	1	—	—	PM	26-Apr-15 12:25:15 PM
Coratin	100.00	ml	1	—	—	PM	30-Sep-23 4:03:30 PM
CO-X	1000.00	Nos	1	—	Packing Material	PM	14-Feb-19 11:56:12 AM
Dubi Chiltion	1.00	Nos	1	—	—	PM	18-Mar-25 10:17:44 AM
Dubi Clodina	150.00	Nos	1	—	Others	PM	12-Mar-23 11:38:47 AM
Dubi Sulfosulfuron	1.00	Nos	1	—	—	PM	24-Mar-25 12:17:17 PM
Emamactin	1000.00	Nos	1	—	—	PM	23-May-15 5:13:53 PM
Flex Nectar shining	5.00	Nos	1	—	Others	PM	25-Feb-15 11:47:23 AM
Inner	1.00	Nos	1	—	—	PM	12-May-15 11:20:08 AM
K-Norish (5:15:45	1.00	kg	1	—	Others	PM	02-Oct-23 2:56:56 PM
Label Aetamiprid SP	250.00	Nos	1	—	Insecticides	PM	10-Jun-15 2:38:33 PM
Label Atrazine	500.00	Nos	1	—	Insecticides	PM	25-Feb-16 10:03:54 AM
Label Chat Pat	300.00	ml	1	—	Others	PM	14-Oct-24 12:43:24 PM
Label Chiltan	100.00	ml	1	—	—	PM	18-Mar-25 10:14:08 AM
Label cypermathrin	250.00	Nos	1	—	Insecticides	PM	31-Jul-18 1:18:42 PM
Label cypermathrin	1000.00	Nos	1	—	Insecticides	PM	31-Jul-18 1:19:11 PM
Label Dimethoate	250.00	ml	1	—	Others	PM	01-Apr-19 4:44:47 PM
Label Emafuron	150.00	ml	1	—	Others	PM	20-Jun-22 11:14:24 AM`,

  // Page 3 (32 items)
  `Label Glint	10.00	ltr	1	—	—	PM	03-Apr-23 9:32:55 AM
Label Glint	20.00	ltr	1	—	—	PM	03-Apr-23 9:33:18 AM
Label Good luck	10.00	ltr	1	—	—	PM	03-Apr-23 9:34:02 AM
Label Good luck	5.00	ltr	1	—	—	PM	03-Apr-23 9:33:45 AM
Label Grow Max	500.00	Nos	1	—	PGR's/Nutrients	PM	24-Sep-17 10:22:19 AM
Label Haili Super	800.00	ml	1	—	Others	PM	29-Apr-25 11:33:45 AM
Label K.Boost-Flow	1.00	ltr	1	—	—	PM	14-Oct-24 2:57:58 PM
Label Kank ultra	350.00	ml	1	—	—	PM	26-Feb-23 11:43:25 AM
Label Laaamba	500.00	ml	1	—	—	PM	16-Mar-25 11:23:34 AM
Label Mai Tu	300.00	ml	1	—	—	PM	14-Oct-24 12:46:56 PM
Label Mantar	200.00	Nos	1	—	Others	PM	06-Jan-21 1:29:34 PM
Label Nectrin	10.00	ltr	1	—	—	PM	03-Apr-23 9:31:10 AM
Label PUBG	250.00	ml	1	—	—	PM	29-Apr-25 11:32:02 AM
Label Sanga	140.00	ml	1	—	—	PM	16-Mar-25 10:41:48 AM
Label Sheding	800.00	ml	1	—	Others	PM	03-Aug-22 11:03:13 PM
Label Thiamethaxam	48.00	gm	1	—	Others	PM	01-Apr-19 4:58:05 PM
Label Tifos	400.00	ml	1	—	—	PM	19-Sep-22 1:54:39 PM
Label Tri-Ultra	400.00	Nos	1	—	Weedicides	PM	24-Nov-20 11:58:46 AM
Label Vilson Paniwala	1.00	ltr	1	—	—	PM	03-Apr-23 9:34:38 AM
Label Yang Sui	325.00	ml	1	—	—	PM	23-Nov-19 11:37:22 AM
Labels Abamectin	1.00	ltr	1	—	Insecticides	PM	14-Oct-24 4:50:47 PM
Labels Acephate PVc	250.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:47:30 AM
Labels Acetamiprid	200.00	ml	1	—	Insecticides	PM	03-Oct-19 5:24:26 PM
Labels Acetochlor	1.00	Nos	1	—	Others	PM	25-Feb-15 11:47:31 AM
Labels Acetochlor	800.00	ml	1	—	Insecticides	PM	05-Aug-19 3:57:32 PM
Labels Acetochlor 100 ml	100.00	Nos	1	—	Weedicides	PM	10-Jun-15 2:30:48 PM
Labels Acitamiprid SL	250.00	Nos	1	—	—	PM	24-May-15 9:52:47 AM
Labels Acord	100.00	Nos	1	—	Insecticides	PM	28-Jun-15 9:44:03 AM
Labels Adjuaint	250.00	Nos	1	—	—	PM	08-Dec-16 12:49:43 PM
Labels Bifenthrin	1000.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:47:32 AM
Labels Bifenthrine	500.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:47:33 AM
Labels Bifinthrin	250.00	Nos	1	—	Insecticides	PM	07-Nov-15 12:21:43 PM`,

  // Page 4 (32 items)
  `Labels Bromoxynyl+MCPA	1.00	Nos	1	—	Weedicides	PM	25-Feb-15 11:47:40 AM
Labels Bromoxynyl+MCPA	800.00	Nos	1	—	Others	PM	25-Feb-15 11:47:38 AM
Labels Bromoxynyl+MCPA	400.00	Nos	1	—	Weedicides	PM	04-Feb-16 12:15:21 PM
Labels Bromoxynyl+MCPA	500.00	Nos	1	—	Weedicides	PM	25-Feb-15 11:47:41 AM
Labels Butachlore	800.00	Nos	1	—	—	PM	11-May-15 2:31:25 PM
Labels Calm 200ml	200.00	ml	1	—	—	PM	20-Apr-16 10:30:22 AM
Labels Ceedo	100.00	Nos	1	—	Others	PM	20-Aug-22 12:11:04 PM
Labels Chao Man	150.00	ml	1	—	Others	PM	20-Jun-22 11:16:04 AM
Labels Chlorpyrifos 40 Ec	1.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:47:42 AM
Labels Chlorpyrifos 40 Ec	250.00	Nos	1	—	—	PM	08-Apr-15 4:37:52 PM
Labels Clodinafop	120.00	Nos	1	—	Weedicides	PM	25-Feb-15 11:47:42 AM
Labels Clover Adjoint 80ml	80.00	Nos	1	—	—	PM	28-May-16 10:28:12 AM
Labels Cober	150.00	ml	1	—	Others	PM	20-Jun-22 11:16:29 AM
Labels Condo	100.00	ml	1	—	Others	PM	03-Aug-22 11:20:21 AM
Labels Conquest	300.00	ml	1	—	—	PM	24-Jun-20 11:40:13 AM
Labels Coratin	100.00	ml	1	—	Others	PM	30-Sep-23 4:07:16 PM
Labels Cosmic	1000.00	Nos	1	—	—	PM	20-Apr-15 12:02:07 PM
Labels Cosmic	500.00	Nos	1	—	—	PM	26-Apr-15 12:27:59 PM
Labels Delta+Tri	1.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:47:43 AM
Labels Deltamethrin	750.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:47:43 AM
Labels Diafenthiuron	400.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:47:44 AM
Labels Difenoconazole	250.00	Nos	1	—	—	PM	25-May-15 11:09:17 AM
Labels Dimethoate	1.00	Nos	1	—	Fertilizer	PM	25-Feb-15 11:47:44 AM
Labels Dino Plus	75.00	gm	1	—	—	PM	19-Sep-23 11:48:06 AM
Labels Dumei	50.00	Nos	1	—	—	PM	16-Oct-24 2:49:04 PM
Labels Elegent	1000.00	ml	1	—	Others	PM	05-Nov-25 3:22:46 PM
Labels Elegent 200ltr	200.00	Nos	1	—	—	PM	14-Jun-16 10:01:06 AM
Labels Elegent Gabro 10ltr	10.00	Nos	1	—	—	PM	16-Mar-25 11:49:12 AM
Labels Eligant	3.00	Nos	1	—	—	PM	26-Apr-15 12:36:08 PM
Labels Emamactin	1000.00	Nos	1	—	—	PM	23-May-15 5:15:45 PM
Labels Emamectin	200.00	Nos	1	—	—	PM	16-Mar-15 3:15:37 PM
Labels Emamectin Benzoate	400.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:47:45 AM`,

  // Page 5 (32 items)
  `Labels Fenoxaprop-p-ethyl	500.00	Nos	1	—	Weedicides	PM	25-Feb-15 11:47:46 AM
Labels Finer	100.00	ml	1	—	—	PM	18-Mar-25 10:42:57 AM
Labels Fipronil	480.00	Nos	1	—	—	PM	16-May-16 2:50:45 PM
Labels Fipronil	480.00	Nos	1	—	Others	PM	16-Oct-24 3:33:15 PM
Labels Flomect	250.00	Nos	1	—	Others	PM	15-Sep-19 1:19:09 PM
Labels Gangwi 1ltr	1.00	Nos	1	—	—	PM	02-Mar-15 9:33:00 AM
Labels Gangwi 500 ml	1.00	Nos	1	—	—	PM	02-Mar-15 9:33:23 AM
Labels Gaznor	500.00	Nos	1	—	Others	PM	09-Jul-19 1:38:56 PM
Labels Glyphosate 48%	1.00	Nos	1	—	—	PM	04-Mar-15 11:55:44 AM
Labels Good luck	3.00	Nos	1	—	Others	PM	25-Feb-15 11:47:46 AM
Labels Good Luck 200ltr	200.00	Nos	1	—	—	PM	14-Jun-16 10:01:28 AM
Labels Good Luck 20ltr	20.00	Nos	1	—	—	PM	14-Jun-16 10:01:42 AM
Labels Gorra kill	600.00	ml	1	—	—	PM	08-May-23 12:11:46 PM
Labels Haili	1000.00	ml	1	—	Insecticides	PM	24-Mar-25 10:03:42 AM
Labels Herbiget	1000.00	Nos	1	—	Herbicides	PM	16-Oct-24 2:42:37 PM
Labels Imida SL	250.00	Nos	1	—	—	PM	24-May-15 9:50:02 AM
Labels Imidacloprid	100.00	Nos	1	—	—	PM	26-Apr-15 12:35:45 PM
Labels Imidacloprid 20 SL	250.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:47:47 AM
Labels Imidacloprid 70 Ws	50.00	Nos	1	—	Weedicides	PM	25-Feb-15 11:47:47 AM
Labels Imidacloprid SL PVC	250.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:47:48 AM
Labels Imidacloprid Wp PVC	250.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:47:48 AM
Labels Imidacloprid Wp PVC	200.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:47:49 AM
Labels KE-KE	35.00	ml	1	—	Insecticides	PM	18-Mar-25 10:43:14 AM
Labels Kick	500.00	ml	1	—	Foliar Fertilizer	PM	03-Oct-22 11:48:03 AM
Labels King Pocker	200.00	ml	1	—	—	PM	29-Apr-21 12:31:12 PM
Labels Knocker 1Ltr	1.00	ltr	1	—	—	PM	20-Apr-16 10:29:59 AM
Labels Lambda	500.00	Nos	1	—	—	PM	07-May-15 1:13:07 PM
Labels Lambda	250.00	Nos	1	—	Others	PM	25-Feb-15 11:47:50 AM
Labels Lambda Cyhalothrin	1.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:47:50 AM
Labels Lufenron	1.00	Nos	1	—	—	PM	24-May-15 9:58:48 AM
Labels Lufenuran	400.00	Nos	1	—	Others	PM	25-Feb-15 11:47:51 AM
Labels Lufenuran	200.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:47:51 AM`,

  // Page 6 (32 items)
  `Labels Mantrol	40.00	gm	1	—	—	PM	07-Sep-22 12:45:22 PM
Labels MCPA	500.00	Nos	1	—	Weedicides	PM	28-May-16 10:39:17 AM
Labels Motevo	100.00	ml	1	—	Others	PM	02-Oct-23 2:56:20 PM
Labels Nat Khat	300.00	ml	1	—	—	PM	03-Nov-20 12:15:01 PM
Labels Nectar Pearl	500.00	ml	1	—	Others	PM	03-Oct-19 5:25:13 PM
Labels Nectrine	4.00	Nos	1	—	—	PM	28-Jun-15 9:45:02 AM
Labels Nectrine 200ltr	200.00	Nos	1	—	—	PM	14-Jun-16 10:01:51 AM
Labels Nectrine 20ltr	20.00	Nos	1	—	—	PM	14-Jun-16 10:02:04 AM
Labels OLA	60.00	gm	1	—	—	PM	19-Sep-23 11:48:24 AM
Labels Paireproxifen	400.00	Nos	1	—	—	PM	25-May-15 11:07:18 AM
Labels Paraquat	1.00	Nos	1	—	Weedicides	PM	25-Feb-15 11:47:52 AM
Labels Pendimethalin 33 Ec	1.00	Nos	1	—	Weedicides	PM	25-Feb-15 11:47:53 AM
Labels Pendimethlin 500ml	500.00	Nos	1	—	—	PM	28-May-16 10:25:56 AM
Labels Profenophos	800.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:47:54 AM
Labels Pyriproxifen	400.00	Nos	1	—	—	PM	28-May-15 2:27:11 PM
Labels Recado 200ml	200.00	ml	1	—	—	PM	20-Apr-16 10:30:10 AM
Labels Recall	1000.00	ml	1	—	—	PM	09-May-21 11:47:20 AM
Labels Sea Bat	350.00	ml	1	—	—	PM	03-Nov-20 12:14:40 PM
Labels Seed Care	1.00	Nos	1	—	—	PM	01-Mar-23 11:19:48 AM
Labels Seega Pest Clear 400ml	400.00	ml	1	—	—	PM	04-Apr-16 3:19:32 PM
Labels Sega Swep	800.00	ml	1	—	—	PM	16-Oct-24 3:32:51 PM
Labels S-Metochlor	400.00	ml	1	—	Herbicides	PM	05-Aug-19 3:55:37 PM
Labels Sudao (Shorajin)	100.00	ml	1	—	Others	PM	30-Sep-23 4:07:36 PM
Labels Sulfonet	120.00	ml	1	—	Others	PM	29-Dec-19 11:32:37 AM
Labels Surprise	250.00	Nos	1	—	—	PM	05-Jun-17 10:29:22 AM
Labels Terror	400.00	ml	1	—	Insecticides	PM	06-Aug-22 12:36:32 PM
Labels Togo	50.00	ml	1	—	Insecticides	PM	16-Mar-25 10:40:03 AM
Labels Triazophos	1.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:47:55 AM
Labels Trip	120.00	ml	1	—	—	PM	02-Jan-23 3:46:55 PM
Labels Tur Bur	1000.00	Nos	1	—	—	PM	15-Nov-21 10:55:37 AM
Labels Twenty Phos	20.00	Nos	1	—	—	PM	05-Nov-25 2:18:51 PM
Labels Walter Super	350.00	Nos	1	—	Weedicides	PM	22-Nov-16 9:41:02 AM`,

  // Page 7 (32 items)
  `Labels Winsta	50.00	gm	1	—	—	PM	08-May-23 11:57:42 AM
Labels Winsta	100.00	gm	1	—	—	PM	08-May-23 11:57:25 AM
Labels Woolmer	1.00	ltr	1	—	—	PM	16-Oct-24 3:34:38 PM
Labels Woolmer	800.00	ml	1	—	—	PM	16-Oct-24 3:34:21 PM
Labels Woolmer 400ml	400.00	Nos	1	—	Packing Material	PM	27-Apr-17 10:15:06 AM
Labels Xiaowang	1.00	Nos	1	—	—	PM	27-Apr-17 1:46:33 PM
Labels yi Nong le	250.00	gm	1	—	—	PM	08-May-23 12:03:37 PM
Lable Acetaclor	250.00	Nos	1	—	—	PM	25-Feb-15 11:47:56 AM
Lable Adjoint sulfo	1.00	Nos	1	—	—	PM	16-Jan-16 12:37:04 PM
Lable Cloth Sorghum	10.00	Nos	1	—	—	PM	05-Apr-17 10:17:29 AM
Lable Kick	500.00	ml	1	—	Others	PM	21-Apr-22 12:03:00 PM
Lable King Pocker	200.00	ml	1	—	Insecticides	PM	04-Mar-20 11:13:58 AM
Lable Lufenruon	1.00	Nos	1	—	—	PM	25-Feb-15 11:47:57 AM
Lable Sulfonat	120.00	ml	1	—	Others	PM	26-Dec-19 11:45:01 AM
Lable Triazophos	1.00	Nos	1	—	Insecticides	PM	08-Jul-15 1:20:22 PM
Lable Walter Super	350.00	Nos	1	—	Weedicides	PM	04-Dec-16 3:06:47 PM
Packing 200ml to Ltr Labour	1.00	Pcs	1	—	—	PM	14-Jan-26 12:53:00 PM
Packing 35ml to 150ml Labour	1.00	Pcs	1	—	—	PM	14-Jan-26 12:52:57 PM
Packing 3kg to 5kg Labour	1.00	Pcs	1	—	—	PM	14-Jan-26 12:52:53 PM
Packing 8kg to 25kg Labour	1.00	Pcs	1	—	—	PM	14-Jan-26 12:53:27 PM
Packing Labeling Labour	1.00	Pcs	1	—	—	PM	14-Jan-26 12:54:15 PM
Packing Labour	1.00	Pcs	1	—	—	PM	25-Feb-15 12:08:56 PM
Packing Material	1.00	Nos	1	—	—	PM	26-Dec-20 2:17:49 PM
PM Dubbi Clodina	150.00	gm	1	—	—	PM	28-Dec-22 10:21:43 AM
pouch	1.00	Nos	1	—	—	PM	16-Jan-16 12:52:16 PM
Pouch Acelam	150.00	gm	1	—	—	PM	03-Oct-22 11:39:29 AM
Pouch Acephate	250.00	Nos	1	—	Insecticides	PM	27-Jul-15 11:28:32 AM
Pouch Acetamiprid	200.00	Nos	1	—	Insecticides	PM	15-Aug-18 12:39:44 PM
Pouch Acitamiprid	250.00	Nos	1	—	Insecticides	PM	27-Jul-15 11:28:42 PM
Pouch Ametryn+Atrazin	500.00	Nos	1	—	Weedicides	PM	04-Feb-16 12:21:32 PM
Pouch Bablo 66% WDG	150.00	gm	1	—	Weedicides	PM	27-Oct-18 2:40:34 PM
Pouch Blue Bell	100.00	gm	1	—	—	PM	09-May-20 10:50:17 AM`,

  // Page 8 (32 items)
  `Pouch Bravo	150.00	gm	1	—	—	PM	26-Feb-23 11:44:21 AM
pouch Buprofyzin	900.00	Nos	1	—	Insecticides	PM	10-Jun-15 2:36:01 PM
Pouch Ceedo	100.00	ml	1	—	—	PM	26-Feb-23 11:43:42 AM
Pouch Clodina	150.00	Nos	1	—	Weedicides	PM	26-Nov-15 10:29:05 AM
Pouch Clodina	160.00	Nos	1	—	Weedicides	PM	08-Dec-18 10:12:39 AM
Pouch Clover 80gm	80.00	Nos	1	—	—	PM	16-May-16 2:52:15 PM
Pouch Concept AG	1.00	Nos	1	—	Others	PM	22-Apr-21 12:42:24 PM
Pouch Danon	6.25	gm	1	—	—	PM	07-Sep-22 12:49:53 PM
Pouch Deft	40.00	gm	1	—	Weedicides	PM	20-Nov-17 1:04:50 PM
Pouch Dinotifuron	100.00	gm	1	—	—	PM	05-Nov-25 2:39:42 PM
Pouch Emamectin	75.00	gm	1	—	Insecticides	PM	05-Nov-25 2:26:21 PM
Pouch Emamectin Benzoate 5 WDG	150.00	Nos	1	—	Insecticides	PM	03-Mar-18 4:03:06 PM
Pouch Fortune	2.00	kg	1	—	—	PM	15-Mar-21 1:40:18 PM
Pouch Full Control	1.00	Nos	1	—	—	PM	15-Mar-21 1:36:37 PM
Pouch Full Pride 200gm	200.00	Nos	1	—	—	PM	16-May-16 2:52:45 PM
Pouch Green Nurish	1.00	kg	1	—	—	PM	06-Aug-22 10:48:50 AM
Pouch Imidacloprid	100.00	Nos	1	—	Insecticides	PM	14-Mar-16 12:50:02 PM
Pouch Imidacloprid 200gm	200.00	Nos	1	—	Insecticides	PM	14-Mar-16 12:50:23 PM
Pouch Instant supper	40.00	Nos	1	—	—	PM	25-May-15 11:06:26 AM
Pouch Isoproturon	800.00	Nos	1	—	Weedicides	PM	26-Nov-15 10:27:48 AM
Pouch Keeper	200.00	gm	1	—	Others	PM	22-Apr-21 12:44:13 PM
Pouch K-Norish	1.00	kg	1	—	Others	PM	02-Oct-23 2:59:30 PM
Pouch Korner	250.00	gm	1	—	—	PM	29-Apr-25 11:26:43 AM
Pouch Matalyxal	250.00	Nos	1	—	Insecticides	PM	04-Feb-16 12:19:36 PM
Pouch Metalyxal	1000.00	Nos	1	—	Insecticides	PM	25-Feb-16 10:04:52 AM
Pouch Metribuzin 100gm	100.00	gm	1	—	—	PM	16-Apr-16 2:22:03 PM
Pouch Metribuzin 70 % WP	250.00	Nos	1	—	Insecticides	PM	23-Sep-17 2:45:41 PM
Pouch N.P.K.20:20:20	500.00	Nos	1	—	—	PM	28-Feb-15 4:43:07 PM
Pouch Novex 30gm	30.00	Nos	1	—	Weedicides	PM	30-Dec-15 12:10:41 PM
Pouch OLA	60.00	gm	1	—	—	PM	03-Aug-22 11:07:11 AM
pouch Qiaoba	600.00	Nos	1	—	—	PM	03-Mar-18 2:25:51 PM
Pouch Sada	1.00	Nos	1	—	—	PM	05-Oct-15 11:48:55 AM`,

  // Page 9 (32 items)
  `Pouch Seed Care	50.00	ml	1	—	—	PM	26-Feb-23 11:43:19 AM
Pouch Sintro	30.00	gm	1	—	Weedicides	PM	16-Nov-17 10:17:53 AM
Pouch Sovisect	125.00	Nos	1	—	—	PM	05-Nov-25 3:43:51 PM
Pouch Star-70	2.00	kg	1	—	—	PM	08-Dec-21 3:34:03 PM
Pouch Stonic	1.00	kg	1	—	Others	PM	02-Oct-23 10:47:34 AM
Pouch Sulfer 1 kg	1.00	Nos	1	—	Fungicides	PM	10-Jun-15 2:36:50 PM
Pouch Sulfosulfuron	13.50	Nos	1	—	Weedicides	PM	04-Dec-16 3:00:29 PM
Pouch Sun Nourish 1Kg	1.00	kg	1	—	—	PM	16-Apr-16 2:20:47 PM
Pouch Sun Nourish 500gm	500.00	gm	1	—	—	PM	16-Apr-16 2:21:14 PM
Pouch Tetrazole&Hypazole	100.00	gm	1	—	Others	PM	18-Mar-25 10:27:03 AM
Pouch Thaeophnit	400.00	Nos	1	—	Fungicides	PM	25-Feb-15 11:48:01 AM
Pouch Thiomethaxam	24.00	Nos	1	—	Insecticides	PM	27-Sep-18 12:32:37 PM
Pouch Thiophanate 100gm	100.00	Nos	1	—	—	PM	16-May-16 2:51:35 PM
Pouch Thiophnate	1000.00	Nos	1	—	Insecticides	PM	16-Oct-24 2:40:23 PM
Pouch Thoimethaxam	48.00	gm	1	—	Others	PM	15-Sep-19 1:14:11 PM
Pouch Trichlorfon	250.00	Nos	1	—	—	PM	08-Apr-15 4:36:56 PM
Pouch Trifet	100.00	gm	1	—	—	PM	03-Apr-23 9:37:27 AM
Pouch Tukker	1.00	Nos	1	—	—	PM	12-Jul-18 1:19:45 PM
Pouch Umbra	24.00	Nos	1	—	Weedicides	PM	28-Dec-17 12:44:02 PM
Pouch Weed Crush	350.00	gm	1	—	—	PM	24-Nov-19 10:13:28 AM
Pouch Winsta	50.00	Nos	1	—	—	PM	24-May-15 9:51:34 AM
Pouch Winsta	100.00	Nos	1	—	—	PM	24-May-15 9:51:21 AM
Pouch Zertis (Chlited zinc)	200.00	gm	1	—	—	PM	29-Apr-25 11:47:23 AM
S.P Acephate	250.00	Nos	1	—	—	PM	24-May-15 9:48:55 AM
S.P Acetamiprid	250.00	Nos	1	—	—	PM	20-Jul-16 10:34:52 AM
S.P Ametryn Bag (S.P)	1.00	Nos	1	—	—	PM	07-Mar-17 4:30:27 PM
S.P Atrazine 500ml	500.00	Nos	1	—	—	PM	23-Aug-16 1:25:30 PM
S.P Bag Print	1.00	Nos	1	—	—	PM	05-Apr-17 10:19:08 AM
S.P Bifinthrin	500.00	Nos	1	—	—	PM	05-Apr-17 10:13:57 AM
S.P Bifinthrin	1000.00	Nos	1	—	—	PM	05-Apr-17 10:14:07 AM
S.P Bravo	150.00	gm	1	—	—	PM	26-Feb-23 11:44:55 AM
S.P Bromo	500.00	Nos	1	—	Weedicides	PM	25-Feb-15 11:48:02 AM`,

  // Page 10 (32 items)
  `S.P Bromo	1000.00	Nos	1	—	Weedicides	PM	20-Jul-16 10:34:58 AM
S.P Bromo	800.00	Nos	1	—	Weedicides	PM	07-Nov-15 11:58:06 AM
S.P Bromoxynil	1000.00	gm	1	—	Weedicides	PM	20-Nov-17 1:06:16 PM
S.P Bromoxynil	400.00	Nos	1	—	Weedicides	PM	26-Nov-15 10:30:59 AM
S.P Buprofezin 900Gm	900.00	Nos	1	—	Insecticides	PM	07-Aug-18 1:17:31 PM
S.P Butachlor 800ml	800.00	Nos	1	—	—	PM	14-Jun-16 9:49:02 AM
S.P Carbofuron	8.00	Nos	1	—	Others	PM	25-Feb-15 11:48:03 AM
S.P Cartap	1.00	Nos	1	—	Others	PM	22-Mar-18 2:42:44 PM
S.P Cholorpyrifos	250.00	Nos	1	—	—	PM	05-Apr-17 10:16:35 AM
S.P Cholorpyrifos 1Ltr	1000.00	Nos	1	—	Insecticides	PM	25-Feb-16 9:52:50 AM
S.P Chopper Pouch 35gm	35.00	Nos	1	—	Weedicides	PM	30-Dec-15 12:05:46 PM
S.P Clodina	130.00	Nos	1	—	Weedicides	PM	26-Nov-15 10:35:25 AM
S.P Clodina Pouch 150gm	150.00	Nos	1	—	Weedicides	PM	30-Dec-15 12:09:17 PM
S.P Clodinafop 140gm	140.00	Nos	1	—	—	PM	13-Dec-17 4:04:05 PM
S.P COC	500.00	Nos	1	—	—	PM	05-Apr-17 10:15:58 AM
S.P D+Tri	1.00	Nos	1	—	—	PM	12-Jul-18 1:20:42 PM
S.P Deft 40 Gm	40.00	gm	1	—	—	PM	17-Jan-18 12:33:04 PM
S.P Dimethoate	200.00	Nos	1	—	Others	PM	29-Apr-19 3:16:16 PM
S.P Elegant Plus 25 Kg	25.00	kg	1	—	—	PM	17-Jan-18 12:33:41 PM
S.P Elegent Bag (2bl)	10.00	Nos	1	—	—	PM	04-Dec-16 3:24:07 PM
S.P Emamctin	200.00	Nos	1	—	—	PM	26-Apr-15 12:37:06 PM
S.P Emamctin	1000.00	Nos	1	—	—	PM	20-Jul-16 10:35:08 AM
S.P Emamctin	400.00	Nos	1	—	—	PM	26-Apr-15 12:36:56 PM
S.P Emamection 150gm	1.00	Nos	1	—	—	PM	27-Jun-18 11:31:54 AM
S.P Fipronil 6Kg	6.00	Nos	1	—	Insecticides	PM	14-Mar-16 12:45:23 PM
S.P Fortune	2.00	kg	1	—	Others	PM	08-Dec-21 3:39:20 PM
S.P Gengwei Ltr	1000.00	Nos	1	—	—	PM	12-Feb-18 12:38:38 PM
S.P Glyphosate	1000.00	Nos	1	—	—	PM	20-Jul-16 10:35:14 AM
S.P Good luck	3.00	ltr	1	—	—	PM	12-Jul-18 1:20:10 PM
S.P Imida 25% WP 200gm	200.00	Nos	1	—	—	PM	25-Feb-16 9:55:00 AM
S.P Imida 70%WS	50.00	Nos	1	—	—	PM	05-Apr-17 10:35:20 AM
S.P Imidacloprid 100gm	100.00	Nos	1	—	Insecticides	PM	25-Feb-16 9:54:39 AM`,

  // Page 11 (32 items)
  `S.P Imidacloprid 200gm (2bl)	200.00	Nos	1	—	Insecticides	PM	25-Feb-16 9:59:10 AM
S.P Isoproturon	800.00	gm	1	—	Weedicides	PM	20-Nov-17 1:06:54 PM
S.P Knocker 1ltr	1000.00	Nos	1	—	—	PM	20-Jul-16 10:35:32 AM
S.P Lambda 1ltr	1000.00	Nos	1	—	Insecticides	PM	20-Jul-16 10:35:35 AM
S.P Lambda 250ml	250.00	Nos	1	—	Insecticides	PM	28-May-16 10:24:20 AM
S.P Lambda 500ml	500.00	Nos	1	—	Insecticides	PM	28-May-16 10:24:04 AM
S.P Lufenuron 400ml	400.00	Nos	1	—	Insecticides	PM	25-Feb-16 10:00:37 AM
S.P MCPA	400.00	ml	1	—	—	PM	12-Jul-18 1:17:32 PM
S.P Metalaxyil Pouch	250.00	Nos	1	—	Insecticides	PM	04-Feb-16 12:16:47 PM
S.P Metri Pouch 2BL	100.00	Nos	1	—	Weedicides	PM	30-Dec-15 12:16:01 PM
S.P Metribuzin 250gm	250.00	Nos	1	—	—	PM	15-Oct-16 12:34:25 AM
S.P Monohypo	1.00	Nos	1	—	—	PM	27-Jun-18 11:31:48 AM
S.P Nectar Bag	1.00	Nos	1	—	—	PM	16-Apr-17 12:39:19 PM
S.P Nectar Bag	1.00	Nos	1	—	—	PM	07-Mar-17 4:30:38 PM
S.P Nectar shining	5.00	Nos	1	—	Others	PM	25-Feb-15 11:48:04 AM
S.P Nectrin	4.00	ltr	1	—	—	PM	23-Nov-19 11:36:26 AM
S.P Paraquat	1000.00	Nos	1	—	Insecticides	PM	16-Apr-17 12:40:49 PM
S.P Peedy Seed	1.00	Nos	1	—	Seeds	PM	11-Jul-17 10:24:28 AM
S.P Power max	100.00	Nos	1	—	Insecticides	PM	26-Aug-17 11:27:58 AM
S.P Sulfo Dabi	13.50	Nos	1	—	Weedicides	PM	07-Nov-15 11:54:42 AM
S.P Sulfosulfuron Sashay	13.50	Nos	1	—	—	PM	04-Dec-16 3:17:24 PM
S.P Sulpher KG	1.00	Nos	1	—	—	PM	27-Jun-18 11:31:49 AM
S.P Sun Norish	500.00	gm	1	—	—	PM	12-Jul-18 1:18:09 PM
S.P Super Sher 10kg	10.00	Nos	1	—	—	PM	07-Mar-17 4:19:24 PM
S.P Super Sher 4kg	4.00	Nos	1	—	Others	PM	25-Feb-16 9:58:45 AM
S.P Super Sher 4kg	4.00	Nos	1	—	—	PM	14-Jun-16 9:47:41 AM
S.P Super Sher 5kg	5.00	Nos	1	—	Insecticides	PM	25-Feb-16 9:59:23 AM
S.P Thiamethoxim	48.00	gm	1	—	—	PM	26-Feb-23 11:41:26 AM
S.P Thiophante 400gm	400.00	Nos	1	—	—	PM	15-Oct-16 12:33:49 AM
S.P Trichlorfan	250.00	gm	1	—	Others	PM	01-Apr-19 5:00:16 PM
S.P Winsta Duby 50gm	50.00	Nos	1	—	—	PM	14-Jun-16 9:47:25 AM
S.P Winsta Duby 50gm (2bl)	50.00	Nos	1	—	—	PM	14-Jun-16 9:53:54 AM`,

  // Page 12 (32 items)
  `Sachet Acephate SP	250.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:48:05 AM
Sachet Acetamiprid SP	250.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:48:05 AM
Sachet Buprofezin	600.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:48:06 AM
Sachet Buprofezin	900.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:48:06 AM
Sachet Clodinafop	120.00	Nos	1	—	Weedicides	PM	25-Feb-15 11:48:07 AM
Sachet Clodinfop	140.00	Nos	1	—	Weedicides	PM	25-Feb-15 11:48:07 AM
Sachet Emamectin WDG	150.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:48:08 AM
Sachet Escort	150.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:48:08 AM
Sachet Imidacloprid WP	250.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:48:09 AM
Sachet Imidacloprid WP	200.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:48:09 AM
Sachet Metalaxyl	250.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:48:10 AM
Sachet Soluble 30X400	1.00	Nos	1	—	—	PM	25-Dec-16 12:30:08 PM
Sachet Sulfosulforan	13.50	Nos	1	—	Weedicides	PM	15-Nov-18 4:05:40 PM
Sachet Thiophenate Methyl	400.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:48:10 AM
Sashay Novex	30.00	Nos	1	—	Weedicides	PM	26-Nov-15 10:54:32 AM
Sickle	13.60	gm	1	—	—	PM	03-Nov-20 12:15:19 PM
Sticker Bottle (White)	800.00	Nos	1	—	—	PM	05-Jul-15 10:05:03 AM
Sticker Clodina	150.00	Nos	1	—	Weedicides	PM	25-Feb-15 11:48:11 AM
Sticker Elegent	500.00	ml	1	—	Others	PM	03-Oct-19 5:24:48 PM
Sticker Fipronil Carton	6.00	Nos	1	—	Insecticides	PM	14-Mar-16 12:45:50 PM
Sticker Monome Mater	7.00	Nos	1	—	—	PM	28-Jun-15 9:43:43 AM
Sticker Nectar screen print	1.00	Nos	1	—	—	PM	25-Feb-15 11:48:11 AM
Sticker Nitro Sulf	10.00	ltr	1	—	—	PM	24-Mar-25 2:24:52 PM
Sticker Pearl Milat	2.25	kg	1	—	—	PM	12-Jul-18 1:18:57 PM
Sticker Sulfosuloran	13.50	Nos	1	—	Weedicides	PM	25-Feb-15 11:48:12 AM
Sticker Thiomethaxam	48.00	gm	1	—	Others	PM	15-Sep-19 1:13:49 PM
Sticker Thiophanate	400.00	gm	1	—	Fungicides	PM	05-Oct-15 11:43:52 AM
Sticker tranparrants	5.00	Nos	1	—	Insecticides	PM	25-Feb-15 11:48:12 AM
Sticker Xuanlijing 40 Gm	40.00	gm	1	—	Others	PM	02-Oct-23 12:34:53 PM
Sudao (Shorajin)	100.00	ml	1	—	—	PM	30-Sep-23 4:03:56 PM
Sulfo Sulfuron Dabi	13.50	Nos	1	—	Weedicides	PM	07-Nov-15 11:54:27 AM
Tapes	1.00	Roll	1	—	Others	PM	10-May-19 12:31:56 PM`,

  // Page 13 (Section 01 ends with 5 items, Section 02 starts with 24 items -> 29 items)
  `Winsta Adjuent	50.00	Nos	1	—	Herbicides	PM	28-May-17 11:23:13 AM
Winsta Adjuent	100.00	Nos	1	—	Herbicides	PM	28-May-17 11:23:18 AM
Winsta Duby 100gm	100.00	Nos	1	—	Herbicides	PM	28-May-17 11:23:21 AM
Winsta Duby 50gm	50.00	Nos	1	—	Herbicides	PM	28-May-17 11:23:24 AM
Zinic Ash	1.00	kg	1	—	Others	PM	31-Jul-19 12:43:02 PM
SECTION: 02 Bottles, cans, caps & tins
Acetamiprid 20 SP (Box)	1.00	Nos	1	—	Packing Material	PM	15-Feb-14 9:52:12 AM
Agri Power Bottle	1.00	Nos	1	—	Packing Material	PM	02-Feb-10 11:48:10 AM
Bottle	3.00	ltr	1	—	Raw material	RM	19-Aug-11 9:47:57 PM
Bottle S.Caps	1.00	Nos	1	—	Packing Material	PM	07-Sep-16 10:17:23 AM
Bottle Stoppless	1.00	Nos	1	—	Packing Material	PM	07-Sep-16 10:17:45 AM
Butachlor	8.00	Nos	1	—	Packing Material	PM	18-Apr-11 10:54:13 AM
Calendar	1.00	Nos	1	—	Special	NT	04-Mar-15 12:45:52 PM
Can 10 ltr	1.00	Nos	1	—	Packing Material	PM	24-Feb-21 12:42:25 PM
Can 20 Ltr Black	1.00	Nos	1	—	PGR's/Nutrients	PM	24-Feb-21 12:40:14 PM
Can 20ltr Orange	1.00	Nos	1	—	Packing Material	PM	24-Feb-21 12:40:30 PM
Can 4Ltr (Silver)	1.00	Nos	1	—	Packing Material	PM	27-Feb-16 10:23:37 AM
Can Silver 3 ltr	3.00	ltr	1	—	Packing Material	PM	17-Apr-16 11:47:37 AM
Can White 3ltr	1.00	Nos	1	—	Packing Material	PM	27-Jun-14 10:20:39 AM
Caps	1.00	Nos	1	—	Packing Material	PM	30-Mar-17 2:37:32 PM
Drum	1.00	Nos	1	—	Packing Material	PM	07-May-15 12:53:41 PM
Empty Can 20ltr	20.00	Nos	1	—	Packing Material	PM	18-May-16 11:54:49 AM
Empty Plastic Drum	1.00	Nos	1	—	Packing Material	PM	21-Feb-14 5:32:37 PM
Empty Rapers Thiophanate	400.00	Nos	1	—	Packing Material	PM	09-Apr-16 1:19:00 PM
Fraight	1.00	Pcs	1	—	Packing Material	PM	10-Nov-24 4:13:25 PM
Get Rid (Jar)	1.00	Nos	1	—	Packing Material	PM	02-Feb-10 11:48:04 AM
Neck Seal	1.00	Nos	1	—	Packing Material	PM	19-Jan-15 12:25:17 PM
Pet Bottle 1 Liter	1.00	Nos	1	—	Packing Material	PM	26-Feb-15 12:31:48 PM
Pet Bottle 1 Liter (Silver)	1.00	Nos	1	—	Packing Material	PM	27-Oct-15 9:56:47 AM
Pet Bottle 1 Ltr (Green)	1.00	Nos	1	—	Packing Material	PM	25-Jun-15 3:13:46 PM`,

  // Page 14 (30 items)
  `Pet Bottle 100 ml	1.00	Nos	1	—	Packing Material	PM	02-Feb-10 11:47:53 AM
Pet Bottle 150ml (White)	1.00	Nos	1	—	Packing Material	PM	17-Feb-22 2:50:50 PM
Pet Bottle 1Ltr (White)	1.00	Nos	1	—	Packing Material	PM	25-Jun-15 3:14:37 PM
Pet Bottle 1Ltr (Yellow)	1.00	Nos	1	—	Packing Material	PM	27-Feb-16 10:20:26 AM
Pet Bottle 1ltr Almend	1.00	Nos	1	—	Packing Material	PM	27-Oct-15 9:58:17 AM
Pet Bottle 200 ml	1.00	Nos	1	—	Packing Material	PM	28-Feb-15 3:40:01 PM
Pet Bottle 250 ml	1.00	Nos	1	—	Packing Material	PM	02-Feb-10 11:47:55 AM
Pet Bottle 250ml (Green)	1.00	Nos	1	—	Packing Material	PM	25-Jun-15 3:14:10 PM
Pet Bottle 250ml (White)	1.00	Nos	1	—	Packing Material	PM	25-Jun-15 3:15:22 PM
Pet Bottle 3 ltr	1.00	Nos	1	—	Packing Material	PM	15-Mar-15 9:58:50 AM
Pet Bottle 400 ml	1.00	Nos	1	—	Packing Material	PM	28-Feb-15 12:12:01 PM
Pet Bottle 480 ml	1.00	Nos	1	—	Packing Material	PM	28-Feb-15 10:29:10 AM
Pet Bottle 500 Ml (Transparent)	1.00	Nos	1	—	Packing Material	PM	16-Jul-10 9:39:41 AM
Pet Bottle 500 ml Euro Neck	1.00	Nos	1	—	Packing Material	PM	13-Dec-23 11:04:30 AM
Pet Bottle 500ml	1.00	Nos	1	—	Packing Material	PM	26-Feb-15 12:31:12 PM
Pet Bottle 500ml (Green)	1.00	Nos	1	—	Packing Material	PM	25-Jun-15 3:13:39 PM
Pet Bottle 500ml (White)	1.00	Nos	1	—	Packing Material	PM	25-Jun-15 3:15:03 PM
Pet Bottle 50ml (Transparent)	1.00	Nos	1	—	Packing Material	PM	14-May-25 4:09:29 PM
Pet Bottle 600ml	1.00	Nos	1	—	Packing Material	PM	13-Jun-24 12:36:27 PM
Pet Bottle 750 ml	1.00	Nos	1	—	Packing Material	PM	26-Feb-15 12:32:25 PM
Pet Bottle 800 ml (Profeno)	1.00	Nos	1	—	Packing Material	PM	28-Jun-10 2:38:53 PM
Pet Bottle 800ml	1.00	Nos	1	—	Packing Material	PM	26-Feb-15 3:40:07 PM
Pet Bottle Imida Pink 100 gm	1.00	Nos	1	—	Packing Material	PM	26-Feb-15 12:31:36 PM
Pet Bottle Imida Pink 50 gm	1.00	Nos	1	—	Packing Material	PM	28-Apr-10 9:29:49 AM
Pet Bottle Lambda Matka	1.00	Nos	1	—	Packing Material	PM	21-Apr-10 2:18:06 PM
Pet Bottle Silver 250 ml	1.00	Nos	1	—	Packing Material	PM	02-Feb-10 11:48:17 AM
Pet Bottle Silver 400ml	1.00	Nos	1	—	Packing Material	PM	11-Apr-10 9:19:42 AM
Pet Bottle Yellow Matka 1 Ltr	1.00	Nos	1	—	Packing Material	PM	26-Apr-10 9:24:28 AM
Tin Cypermethrine	1.00	Nos	1	—	Packing Material	PM	02-Feb-10 11:48:01 AM
Tin Perfenofos	1.00	Nos	1	—	Packing Material	PM	02-Feb-10 11:48:02 AM`,

  // Page 15 (Section 03: 24 items, Section 04: 5 items -> 29 items)
  `SECTION: 03 Cartons and finished goods
Carton (150ml Luf+Orien+Mtevo)	1.00	Nos	1	—	Packing Material	PM	02-Dec-24 1:26:43 PM
Carton 1 x 10 (bupro)	1.00	Nos	1	—	Packing Material	PM	07-Jul-10 7:03:38 PM
Carton 1 x 10 (Delta)	1.00	Nos	1	—	Packing Material	PM	29-Jul-10 6:11:53 PM
Carton 1 x 10 (Pendi)	1.00	Nos	1	—	Packing Material	PM	29-Jul-10 6:01:19 PM
Carton 1 x 10 (White)	1.00	Nos	1	—	Packing Material	PM	26-Aug-10 2:35:39 PM
Carton 1 x 12 (Bromoxnal 1Ltr)	1.00	Nos	1	—	Packing Material	PM	06-Dec-10 11:35:40 AM
Carton 1 x 15 (Sulfer+SN+KN)	1.00	Nos	1	—	Packing Material	PM	02-Dec-24 1:23:48 PM
Carton 1 x 2 (Suport sheet)	1.00	Nos	1	—	Packing Material	PM	02-Dec-24 1:24:55 PM
Carton 1 x 20 (250gm)	1.00	Nos	1	—	Packing Material	PM	08-Jul-10 3:15:51 PM
Carton 1 x 20 (250ml)	1.00	Nos	1	—	Packing Material	PM	24-Feb-10 4:33:47 PM
Carton 1 x 20 (500ml)	1.00	Nos	1	—	Packing Material	PM	24-Feb-10 4:33:26 PM
Carton 1 x 20 Imida Pink	1.00	Nos	1	—	Packing Material	PM	24-Feb-10 4:33:37 PM
Carton 1 x 3 (Carbofuran+Mono)	1.00	Nos	1	—	Packing Material	PM	14-May-25 10:32:59 AM
Carton 1 x 30 (200ml Ceedo+Coratn)	1.00	Nos	1	—	Packing Material	PM	02-Dec-24 1:24:09 PM
Carton 1 x 4 (Metro)	1.00	Nos	1	—	Packing Material	PM	08-Jul-10 4:19:30 PM
Carton 14 x 75 Somy Ultra)	1.00	Nos	1	—	Packing Material	PM	26-Oct-21 11:44:29 AM
Carton 1x 10 (Blue)	1.00	Nos	1	—	Packing Material	PM	26-Aug-10 2:35:50 PM
Carton Cartap	9.00	kg	2	—	Packing Material	PM	27-Jul-15 11:30:04 AM
Carton Super Sher	4.00	kg	1	—	Others	PM	21-Feb-15 11:09:25 AM
Chopper	25.00	kg	100	—	Weedicides	FG	21-Nov-14 11:26:58 AM
Combo Sheet	1.00	Nos	1	—	Packing Material	PM	10-Feb-25 1:33:13 PM
FH-142	5.00	kg	1	—	Seeds	FG	08-Apr-17 3:56:42 PM
IUB-13	5.00	kg	1	—	Seeds	FG	08-Apr-17 3:55:59 PM
New daimond	10.00	ltr	1	—	Insecticides	PM	04-Mar-15 12:45:12 PM
SECTION: 04 Shrink wrapping, packing expenses & glue
chopper	25.00	Nos	1	—	—	FG	02-Mar-15 9:35:02 AM
Shrink 100 ml Pack	1.00	Nos	1	—	Insecticides	PM	02-Mar-15 9:35:04 AM
Shrink 1000 ml Pack	1.00	Nos	1	—	—	PM	02-Mar-15 9:34:55 AM
Shrink 250 ml Pack	1.00	Nos	1	—	Insecticides	PM	02-Mar-15 9:35:06 AM
Shrink 500 ml Pack	1.00	Nos	1	—	Insecticides	PM	02-Mar-15 9:35:08 AM`,

  // Page 16 (Section 04 ends with 5 items, Section 05 starts with 24 items -> 29 items)
  `Shrink Liter Pack	1.00	Nos	1	—	Insecticides	PM	02-Mar-15 9:35:09 AM
Shrink 250gm	1.00	Nos	1	—	Insecticides	PM	20-Aug-15 11:01:28 AM
Packing expense	1.00	Nos	1	—	Insecticides	PM	28-May-15 2:28:28 PM
Packing Tape	1.00	Nos	1	—	Packing Material	PM	02-Feb-10 11:49:01 AM
Glue	1.00	kg	1	—	Packing Material	PM	10-May-19 12:31:56 PM
SECTION: 05 General, promotional & non-trade items
Adjustment	1.00	Nos	1	—	Others	NT	30-Sep-18 1:56:16 PM
Advertising Pade	1.00	Nos	1	—	Others	NT	26-Nov-15 10:37:50 AM
Aneeq Seed Letter Pade	1.00	Nos	1	—	Packing Material	NT	15-Oct-16 12:31:58 AM
Bags	1.00	Nos	1	—	Others	NT	30-Mar-10 11:31:17 AM
Banner 9*3	1.00	Nos	1	—	Others	NT	26-Aug-10 12:25:18 PM
Banner Stage	1.00	Nos	1	—	Others	NT	26-Aug-10 12:25:22 PM
Bectria	1.00	Nos	1	—	Others	NT	06-Apr-19 10:26:45 AM
Bill Book	1.00	Pcs	1	—	Others	NT	04-Nov-11 9:46:49 AM
Bill No.97	1.00	Nos	1	—	—	NT	24-Jun-20 12:23:06 PM
Block	1.00	Nos	1	—	Others	NT	24-Jan-22 11:04:32 AM
Board 10*3	1.00	Nos	1	—	—	NT	07-Mar-17 4:22:22 PM
Board 10*4	1.00	Nos	1	—	—	NT	07-Mar-17 4:22:13 PM
Board 12*4	1.00	Nos	1	—	—	NT	07-Mar-17 4:22:30 PM
Board 7*4	1.00	Nos	1	—	—	NT	07-Mar-17 4:22:03 PM
Board 8*4	1.00	Nos	1	—	—	NT	07-Mar-17 4:22:40 PM
Book Let	1.00	Nos	1	—	Others	NT	08-Dec-21 3:37:49 PM
Box of Coupens	1.00	Nos	1	—	Others	NT	30-Mar-10 11:31:03 AM
Bricks	1.00	Nos	1	—	—	NT	14-Jan-21 4:09:13 PM
Brouchure Walter Super	1.00	Nos	1	—	—	NT	04-Dec-16 3:18:46 PM
Brown Table Executive	1.00	Nos	1	—	Others	NT	27-Oct-10 9:47:12 AM
Cabnit Brown	1.00	Nos	1	—	Others	NT	27-Oct-10 9:49:40 AM
Calender	1.00	Nos	1	—	Others	NT	17-Jan-17 6:38:16 PM
Caps	1.00	Nos	1	—	Others	NT	25-Jun-10 9:43:34 AM
Car Flex Pasting	1.00	Nos	1	—	Others	NT	04-Dec-16 3:11:03 PM`,

  // Page 17 (32 items)
  `Cash Received	1.00	Nos	1	—	Others	NT	19-Aug-17 12:03:07 PM
Cement	1.00	Nos	1	—	Others	NT	14-Jan-21 4:08:53 PM
Chair wheels	1.00	Nos	1	—	Others	NT	27-Oct-10 9:50:02 AM
Construction Material	1.00	Nos	1	—	Others	NT	08-Aug-18 2:49:09 PM
Cosmic & Fertonic Flex's	1.00	Nos	1	—	Packing Material	NT	14-Mar-16 12:47:40 PM
Coupen books	1.00	Nos	1	—	Others	NT	30-Mar-10 11:30:36 AM
Cultus One Vision Flex	1.00	Nos	1	—	Packing Material	NT	15-Oct-16 12:27:27 AM
Cylinder (MAP)	1.00	Nos	1	—	—	NT	16-Nov-20 3:38:24 PM
Cylinder Acephate	1.00	Nos	1	—	Others	NT	26-Aug-10 12:25:54 PM
Cylinder Bifenthrin	1.00	Nos	1	—	Others	NT	26-Aug-10 12:25:39 PM
Cylinder Buprofezin	1.00	Nos	1	—	Others	NT	26-Aug-10 12:26:36 PM
Cylinder Chlorpyrifos	1.00	Nos	1	—	Insecticides	NT	07-Nov-15 12:04:52 PM
Cylinder Clodian Pouch	150.00	Nos	1	—	Others	NT	07-Nov-15 12:04:32 PM
Cylinder Fipronil	1.00	Nos	1	—	—	NT	07-Mar-17 4:25:48 PM
Cylinder Imidacloprid	1.00	Nos	1	—	Others	NT	26-Aug-10 12:26:15 PM
Cylinder Lufenron	1.00	Nos	1	—	Others	NT	26-Aug-10 12:25:32 PM
Cylinder Monomehypho	7.00	Nos	1	—	Others	NT	09-Jul-19 1:39:39 PM
Cylinder Neck Seal	1.00	Nos	1	—	Others	NT	27-Apr-17 10:10:44 AM
Cylinder Sulphur	1.00	Nos	1	—	Others	NT	26-Feb-19 12:23:24 PM
Cylinder Super sher 10KG	1.00	Nos	1	—	Others	NT	26-Feb-19 12:24:34 PM
Dairy	1.00	Nos	1	—	Others	NT	30-Dec-15 12:14:08 PM
Dealer Ships	1.00	Nos	1	—	Others	NT	30-Mar-10 11:30:07 AM
Dealership Cards Aneeqa Seeds	1.00	Nos	1	—	Packing Material	NT	16-Apr-17 12:39:02 PM
Design Process	1.00	Nos	1	—	Packing Material	NT	28-May-17 11:11:25 AM
Dingle Plait Change	1.00	Nos	1	—	Others	NT	22-Apr-24 12:49:37 PM
Empty Plastic Drum	1.00	Nos	1	—	Others	NT	21-Feb-14 5:30:58 PM
Envelop (Big)	1.00	Nos	1	—	Others	NT	30-Mar-10 11:29:21 AM
Envelop (small)	1.00	Nos	1	—	Others	NT	30-Mar-10 11:29:30 AM
Expense Sheet Book	1.00	Nos	1	—	Others	NT	25-Feb-16 10:11:27 AM
Felx Cosmic 2.5*8 Feet	1.00	Nos	1	—	Others	NT	16-Jan-17 1:17:48 PM
Fertonic + Nectrown (Flex+Frame)	1.00	Nos	1	—	Packing Material	NT	15-Oct-16 12:29:35 AM
Fiel Muaina Sfarshaat Book	1.00	Nos	1	—	Others	NT	24-Mar-25 2:12:02 PM`,

  // Page 18 (32 items)
  `Field Advoisory Book	1.00	Nos	1	—	Others	NT	23-Mar-25 1:50:26 PM
File Covers	1.00	Nos	1	—	Others	NT	30-Mar-10 11:29:47 AM
Flex 10x15	1.00	Nos	1	—	—	NT	03-Apr-23 9:38:19 AM
Flex 15*20	1.00	Nos	1	—	Others	NT	03-Apr-23 9:38:06 AM
Flex 6.5x14	1.00	Nos	1	—	—	NT	23-Feb-15 3:49:17 PM
Flex 6x8.5	1.00	Nos	1	—	—	NT	23-Feb-15 3:49:58 PM
Flex Cultus 1 Vision	1.00	Nos	1	—	—	NT	04-Dec-16 3:23:08 PM
Flex Elegent 2.5*8 Feet	1.00	Nos	1	—	Others	NT	16-Jan-17 1:15:50 PM
Flex Fertonic 2.5*8 Feet	1.00	Nos	1	—	Others	NT	16-Jan-17 1:17:30 PM
Flex fram.	1.00	Nos	1	—	Packing Material	PM	16-Mar-15 3:18:20 PM
flex gate 9*5	1.00	Nos	1	—	Others	NT	16-Mar-15 3:17:29 PM
Flex GLI 1 Vision	1.00	Nos	1	—	Others	NT	22-Apr-24 12:48:18 PM
Flex Good Luck 2.5*8 Feet	1.00	Nos	1	—	Others	NT	16-Jan-17 1:18:12 PM
Flex Honda City 1 Vision	1.00	Nos	1	—	Others	NT	22-Apr-24 12:47:51 PM
Flex Mehran 1 Vision	1.00	Nos	1	—	Others	NT	22-Apr-24 12:48:37 PM
Flex monomi	1.00	Nos	1	—	Others	NT	16-Mar-15 3:17:50 PM
Flex Nectar Shining Zinc 2.5*8 Feet	1.00	Nos	1	—	Others	NT	16-Jan-17 1:16:43 PM
Flex Nectrown 2.5*8 Feet	1.00	Nos	1	—	Others	NT	16-Jan-17 1:16:14 PM
Flex Pasting	1.00	Nos	1	—	Packing Material	PM	16-Mar-15 3:18:46 PM
Flex Super Sher 2.5*8 Feet	1.00	Nos	1	—	Others	NT	16-Jan-17 1:17:11 PM
Flex WagonR 1 Vision	1.00	Nos	1	—	Others	NT	22-Apr-24 12:47:31 PM
Flex Yaris 1 Vision	1.00	Nos	1	—	Others	NT	22-Apr-24 12:48:54 PM
Flexo Printing Stereo	1.00	Nos	1	—	Others	NT	02-Oct-18 2:18:48 PM
Frames Umra LED Bike Mobile	1.00	Nos	1	—	Others	NT	09-Jul-19 1:36:42 PM
Freight inward	1.00	Nos	1	—	Others	NT	15-Jan-10 2:23:00 PM
Freight wheat	1.00	Nos	1	—	Others	NT	24-Apr-17 11:57:22 AM
Glass 4.5 X 1 Flex Venail	1.00	Nos	1	—	Packing Material	NT	15-Oct-16 12:30:15 AM
Goody Poster Stickers	1.00	Nos	1	—	Packing Material	NT	14-Oct-24 3:14:24 PM
Honda City One Vision Flex	1.00	Nos	1	—	Packing Material	NT	15-Oct-16 12:27:45 AM
Hundai	1.00	Nos	1	—	Others	NT	18-Feb-17 10:42:19 AM
Inner Bags	1.00	kg	1	—	Packing Materials	NT	03-Jun-09 11:32:38 PM
Invitiation Card with Envelops	1.00	Nos	1	—	Others	NT	30-Mar-10 11:30:51 AM`,

  // Page 19 (32 items)
  `Inward Gate pass book	1.00	Nos	1	—	Others	NT	02-Jan-18 12:38:40 PM
Key Ring	1.00	Nos	1	—	Others	NT	24-Apr-24 12:16:28 PM
KG Hi-Dency	1.00	Nos	1	—	Packing Material	NT	24-Jan-22 11:02:44 AM
Kino	1.00	Nos	1	—	Others	NT	20-Jan-21 10:12:59 AM
Kissan Khushal Mulk Khushal	1.00	Nos	1	—	Others	NT	22-May-10 10:46:42 AM
Labour	1.00	Nos	1	—	Others	NT	14-Jan-21 4:10:12 PM
Letter pade	1.00	Nos	1	—	Others	NT	25-Feb-16 10:08:38 AM
Letter Pade Page's	1.00	Nos	1	—	Others	NT	25-Feb-16 10:09:11 AM
Lifter	1.00	Nos	1	—	Others	NT	27-Oct-10 9:50:22 AM
Loading	1.00	Nos	1	—	—	NT	03-Apr-17 11:06:24 AM
Logo 1 X 1 Flex Venail	1.00	Nos	1	—	Packing Material	NT	15-Oct-16 12:30:41 AM
Measuring Cups	1.00	Nos	1	—	Packing Materials	NT	30-Mar-10 11:29:13 AM
Meeting Hand Bags	1.00	Nos	1	—	Packing Material	NT	16-Jan-17 1:19:41 PM
Mehran One Vision Flex	1.00	Nos	1	—	Packing Material	NT	15-Oct-16 12:26:46 AM
Mineral Water Can	19.00	ltr	1	—	Packing Material	NT	10-Apr-16 9:45:22 AM
Neck Seal (PVC)	1.00	ml	1	—	Packing Material	NT	30-Mar-10 11:31:52 AM
Neck Seals	1.00	Nos	1	—	Packing Materials	NT	30-Mar-10 11:29:42 AM
Nectar Address Sticker	1.00	Nos	1	—	Others	NT	25-Feb-16 10:13:29 AM
Nectar Car Logo Flex	1.00	Nos	1	—	Packing Material	NT	05-Apr-17 10:35:42 AM
Nectar Dairy	1.00	Nos	1	—	Others	NT	30-Dec-15 12:14:29 PM
Nectar Office Flex	1.00	Nos	1	—	—	NT	23-Feb-15 3:50:33 PM
Nectar Shining + Elegent (Flec+Frame)	1.00	Nos	1	—	Packing Material	NT	15-Oct-16 12:29:44 AM
Nectrine & G.Luck Flex's	1.00	Nos	1	—	Packing Material	NT	14-Mar-16 12:46:52 PM
Office Bags	1.00	Nos	1	—	Others	NT	30-Mar-10 11:30:24 AM
Oredr Sheet Book	1.00	Nos	1	—	Packing Material	NT	29-Jan-17 10:26:52 PM
Others	1.00	P/U	1	—	Others	NT	30-Mar-10 11:32:28 AM
Outward Gate Pass Book	1.00	Nos	1	—	Packing Material	NT	20-Jul-16 10:23:57 AM
Paint Material	1.00	Nos	1	—	Others	NT	06-May-21 4:11:05 PM
Pauch Thiophnate	1.00	Nos	1	—	—	NT	24-Jan-22 11:03:56 AM
Pearl Millat Broucher	1.00	Nos	1	—	Packing Material	NT	20-Jul-16 10:19:59 AM
Pearl Millet Flex's	1.00	Nos	1	—	Packing Material	NT	14-Jun-16 9:52:29 AM
Pick Up	1.00	Nos	1	—	Others	NT	09-Mar-16 10:35:51 AM`,

  // Page 20 (32 items)
  `Process Charges	1.00	Nos	1	—	—	NT	29-Jan-17 10:32:57 PM
Product Broucher	1.00	Nos	1	—	Packing Material	NT	04-Apr-16 3:14:53 PM
Prs Books	1.00	Nos	1	—	Others	NT	30-Mar-10 11:31:26 AM
Publicity Pad	1.00	Nos	1	—	Packing Material	NT	20-Jul-16 10:20:26 AM
Registration	1.00	Nos	1	—	Others	NT	09-Jul-19 4:12:33 PM
Rent	1.00	Roll	1	—	Others	NT	19-Sep-11 1:06:42 PM
Rickshaw Supply	1.00	Nos	1	—	Others	NT	09-Mar-16 10:36:26 AM
Sand&Ston	1.00	Nos	1	—	Others	NT	28-Jan-21 11:40:06 AM
Sariya	1.00	Nos	1	—	Others	NT	14-Jan-21 4:10:24 PM
Screen Printing	1.00	Nos	1	—	Others	NT	08-Jul-10 4:44:52 PM
Seal Stickers	1.00	Nos	1	—	—	NT	19-Sep-23 2:30:45 PM
Sealer	1.00	Nos	1	—	PGR's/Nutrients	NT	31-Jul-19 12:43:23 PM
Shields	1.00	Nos	1	—	Others	NT	26-Feb-19 11:59:06 AM
Shutter 6 X 1 Flex Stare	1.00	Nos	1	—	Packing Material	NT	15-Oct-16 12:31:03 AM
Sinck	1.00	Nos	1	—	Others	NT	14-Jan-21 4:15:11 PM
Skins 5*2	1.00	Nos	1	—	Others	NT	26-Aug-10 12:25:26 PM
Stamps	1.00	Nos	1	—	Others	NT	26-Feb-19 12:10:56 PM
Stands	1.00	Nos	1	—	Others	NT	26-Aug-10 12:25:30 PM
Stickers Box	1.00	Nos	1	—	Packing Material	NT	24-Mar-25 2:16:57 PM
Stickers Clodina	1.00	Nos	1	—	Packing Materials	NT	19-Feb-15 4:05:24 PM
Stickers Vehicles	1.00	Nos	1	—	Others	NT	30-Mar-10 11:29:37 AM
Stopper	1.00	Nos	1	—	Packing Material	NT	05-Mar-22 6:33:41 PM
Super Sher & Shining Zinc Flex	1.00	Nos	1	—	Packing Material	NT	20-Jul-16 10:19:29 AM
Super Sher & Zinc 21% Flex's	1.00	Nos	1	—	Packing Material	NT	14-Mar-16 12:47:21 PM
Super Sher Flex + New Frame	1.00	Nos	1	—	Packing Material	NT	15-Oct-16 12:31:25 AM
Tags	1.00	Nos	1	—	Others	NT	23-Mar-25 1:43:05 PM
Transfer book	1.00	Nos	1	—	Others	NT	02-Mar-15 9:39:48 AM
Transfer Note Book	1.00	Nos	1	—	—	NT	04-Dec-16 3:23:41 PM
Visiting Cards	1.00	Nos	1	—	Others	NT	30-Mar-10 11:30:30 AM
Visiting Cards Khawar Bilal	1.00	Nos	1	—	Others	NT	25-Feb-16 10:01:45 AM
Visiting Cards M.Arsahd Tarar	1.00	Nos	1	—	Others	NT	25-Feb-16 10:02:04 AM
Visiting Cards m.Arshad Baryar	1.00	Nos	1	—	Others	NT	25-Feb-16 10:02:22 AM`,

  // Page 21 (7 items)
  `Visiting Cards Malik Akbar	1.00	Nos	1	—	Others	NT	25-Feb-16 10:01:19 AM
Visitors Chairs	1.00	Nos	1	—	Others	NT	27-Oct-10 9:49:16 AM
Vouchers	1.00	Nos	1	—	Others	NT	30-Mar-10 11:31:08 AM
Wagnor Car 2 Units Reg#3122 ,3123	1.00	Nos	1	—	Others	NT	30-Sep-18 12:59:04 PM
Wall Calenders	1.00	Nos	1	—	Others	NT	30-Mar-10 11:30:57 AM
Wall Calenders	1.00	Nos	1	—	Others	NT	30-Mar-10 11:29:06 AM
Wall Clock	1.00	Nos	1	—	Packing Material	NT	25-Feb-16 10:17:01 AM`
];

module.exports = { rawPages };
