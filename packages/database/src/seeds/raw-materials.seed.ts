export interface RawMaterialSeedItem {
  sCode: string;
  dCode: string;
  name: string;
  packing: number;
  unit: 'kg' | 'ltr' | 'ml';
  ppc: number;
  mType: string;
  type: string;
  ts: string;
}

export const RAW_MATERIALS_CATALOG: RawMaterialSeedItem[] = [
  // Page 1
  { sCode: '4151', dCode: '41-51-252', name: 'Acelam 26% WDG', packing: 25.00, unit: 'kg', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '10-Jul-23 12:26:32 PM' },
  { sCode: '4151', dCode: '41-51-237', name: 'Acephate', packing: 25.00, unit: 'kg', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '09-Apr-23 12:14:34 PM' },
  { sCode: '4151', dCode: '41-51-210', name: 'Acetamaprid 20 SP', packing: 25.00, unit: 'kg', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '25-Sep-22 1:12:54 PM' },
  { sCode: '4151', dCode: '41-51-211', name: 'Acetochlor 50%EC', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Weedicides', type: 'RM', ts: '25-Sep-22 1:13:18 PM' },
  { sCode: '4151', dCode: '41-51-212', name: 'Acord', packing: 25.00, unit: 'kg', ppc: 1, mType: 'Fungicides', type: 'RM', ts: '25-Sep-22 1:13:55 PM' },
  { sCode: '4151', dCode: '41-51-213', name: 'Adjuaint', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Weedicides', type: 'RM', ts: '25-Sep-22 1:14:34 PM' },
  { sCode: '4151', dCode: '41-51-214', name: 'Atrazine', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '25-Sep-22 1:15:03 PM' },
  { sCode: '4151', dCode: '41-51-201', name: 'Bifenthrin 10%EC', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '17-Mar-22 11:05:18 AM' },
  { sCode: '4151', dCode: '41-51-220', name: 'Bio-Stimilant', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '15-Oct-22 12:31:59 PM' },
  { sCode: '4151', dCode: '41-51-215', name: 'Bromoxynil + MCPA 40% EC', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Weedicides', type: 'RM', ts: '25-Sep-22 1:15:26 PM' },
  { sCode: '4151', dCode: '41-51-216', name: 'Buprofezin 25% WP', packing: 25.00, unit: 'kg', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '25-Sep-22 1:15:55 PM' },
  { sCode: '4151', dCode: '41-51-247', name: 'Butachlor 60% EC', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Herbicides', type: 'RM', ts: '25-May-23 2:11:44 PM' },
  { sCode: '4151', dCode: '41-51-244', name: 'Cartap (Technical)', packing: 25.00, unit: 'kg', ppc: 1, mType: 'Granules', type: 'RM', ts: '25-May-23 1:35:12 PM' },
  { sCode: '4151', dCode: '41-51-235', name: 'Ceed Care', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Weedicides', type: 'RM', ts: '28-Mar-23 11:11:46 AM' },
  { sCode: '4151', dCode: '41-51-240', name: 'Ceedo', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '10-May-23 12:33:37 PM' },
  { sCode: '4151', dCode: '41-51-202', name: 'Chlorpyrifos 40%EC', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '17-Mar-22 11:06:32 AM' },
  { sCode: '4151', dCode: '41-51-230', name: 'Clodina', packing: 25.00, unit: 'kg', ppc: 1, mType: 'Weedicides', type: 'RM', ts: '18-Mar-23 4:15:17 PM' },
  { sCode: '4151', dCode: '41-51-228', name: 'Compact Super', packing: 350.00, unit: 'ml', ppc: 1, mType: 'Weedicides', type: 'RM', ts: '22-Nov-22 1:59:19 PM' },
  { sCode: '4151', dCode: '41-51-232', name: 'Condo', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Herbicides', type: 'RM', ts: '19-Mar-23 1:03:58 PM' },
  { sCode: '4151', dCode: '41-51-258', name: 'Coratin', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '14-Oct-23 12:53:27 PM' },
  { sCode: '4151', dCode: '41-51-229', name: 'Deft', packing: 25.00, unit: 'kg', ppc: 1, mType: 'Weedicides', type: 'RM', ts: '18-Mar-23 3:50:00 PM' },
  { sCode: '4151', dCode: '41-51-222', name: 'Dimethoat', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '15-Oct-22 12:55:03 PM' },
  { sCode: '4151', dCode: '41-51-254', name: 'Dino Plus', packing: 25.00, unit: 'kg', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '11-Sep-23 4:12:11 PM' },
  { sCode: '4151', dCode: '41-51-203', name: 'Emamectin Benzoate 1.9 EC', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '17-Mar-22 11:06:57 AM' },
  { sCode: '4151', dCode: '41-51-223', name: 'Fipronil', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '16-Oct-22 1:18:17 PM' },
  { sCode: '4151', dCode: '41-51-255', name: 'Fipronil Tech', packing: 25.00, unit: 'kg', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '12-Sep-23 3:29:25 PM' },
  { sCode: '4151', dCode: '41-51-226', name: 'Fortune', packing: 25.00, unit: 'kg', ppc: 1, mType: "PGR's/Nutrients", type: 'RM', ts: '17-Nov-22 12:25:37 PM' },
  { sCode: '4151', dCode: '41-51-206', name: 'Full Control', packing: 25.00, unit: 'kg', ppc: 1, mType: 'Herbicides', type: 'RM', ts: '22-Mar-22 11:10:38 AM' },
  { sCode: '4151', dCode: '41-51-246', name: 'Gazoner (Calm)', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Herbicides', type: 'RM', ts: '25-May-23 2:03:56 PM' },
  { sCode: '4151', dCode: '41-51-204', name: 'Gengwei 55%SC', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Herbicides', type: 'RM', ts: '17-Mar-22 11:07:27 AM' },
  { sCode: '4151', dCode: '41-51-219', name: 'Glyphosate', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Herbicides', type: 'RM', ts: '15-Oct-22 12:28:10 PM' },
  { sCode: '4151', dCode: '41-51-239', name: 'Gorra Kill', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '06-May-23 3:31:16 PM' },
  { sCode: '4151', dCode: '41-51-207', name: 'Imidacloprid 25 WP', packing: 25.00, unit: 'kg', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '22-Mar-22 11:10:25 AM' },
  { sCode: '4151', dCode: '41-51-253', name: 'Instant Super', packing: 25.00, unit: 'kg', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '05-Sep-23 5:15:56 PM' },
  { sCode: '4151', dCode: '41-51-259', name: 'K-Nourish (NPK5:15:45', packing: 25.00, unit: 'kg', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '14-Oct-23 1:35:21 PM' },

  // Page 2
  { sCode: '4151', dCode: '41-51-205', name: 'Lambda Cyhalothrin 2.5 % EC', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '17-Mar-22 11:07:51 AM' },
  { sCode: '4151', dCode: '41-51-241', name: 'Lufenuron', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '10-May-23 12:34:06 PM' },
  { sCode: '4151', dCode: '41-51-260', name: 'MCPA', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Weedicides', type: 'RM', ts: '29-Oct-23 12:34:19 PM' },
  { sCode: '4151', dCode: '41-51-221', name: 'Mestal', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '15-Oct-22 12:37:50 PM' },
  { sCode: '4151', dCode: '41-51-225', name: 'Metalaxyl+Mancozeb 72% WP', packing: 25.00, unit: 'kg', ppc: 1, mType: 'Fungicides', type: 'RM', ts: '14-Nov-22 3:19:31 PM' },
  { sCode: '4151', dCode: '41-51-217', name: 'Metribuzin 70 % WP', packing: 20.00, unit: 'kg', ppc: 1, mType: 'Weedicides', type: 'RM', ts: '05-Oct-22 5:55:56 PM' },
  { sCode: '4151', dCode: '41-51-238', name: 'Monomehypo (technical)', packing: 25.00, unit: 'kg', ppc: 1, mType: 'Granules', type: 'RM', ts: '06-May-23 2:49:56 PM' },
  { sCode: '4151', dCode: '41-51-250', name: 'Nectar Pearl', packing: 200.00, unit: 'ltr', ppc: 1, mType: "PGR's/Nutrients", type: 'RM', ts: '04-Jul-23 10:41:45 AM' },
  { sCode: '4151', dCode: '41-51-245', name: 'OLA 50% WG', packing: 25.00, unit: 'kg', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '25-May-23 1:44:16 PM' },
  { sCode: '4151', dCode: '41-51-218', name: 'Paraquat', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '15-Oct-22 11:12:38 AM' },
  { sCode: '4151', dCode: '41-51-257', name: 'Pendimethalin 33% EC', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Herbicides', type: 'RM', ts: '14-Oct-23 11:35:01 AM' },
  { sCode: '4151', dCode: '41-51-249', name: 'Profenofos 50 EC W/V', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '25-May-23 2:37:13 PM' },
  { sCode: '4151', dCode: '41-51-243', name: 'Pyriproxifen', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '20-May-23 1:01:55 PM' },
  { sCode: '4151', dCode: '41-51-234', name: 'Seed Care', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '26-Mar-23 10:58:26 AM' },
  { sCode: '4151', dCode: '41-51-256', name: 'Sheding', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '12-Sep-23 3:50:44 PM' },
  { sCode: '4151', dCode: '41-51-224', name: 'Somy Ultra', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Weedicides', type: 'RM', ts: '05-Nov-22 3:45:49 PM' },
  { sCode: '4151', dCode: '41-51-227', name: 'Sun Nourish', packing: 25.00, unit: 'kg', ppc: 1, mType: "PGR's/Nutrients", type: 'RM', ts: '17-Nov-22 12:25:55 PM' },
  { sCode: '4151', dCode: '41-51-231', name: 'Super Sher', packing: 50.00, unit: 'kg', ppc: 1, mType: "PGR's/Nutrients", type: 'RM', ts: '19-Mar-23 12:54:49 PM' },
  { sCode: '4151', dCode: '41-51-209', name: 'Thiamethoxam 25%', packing: 25.00, unit: 'kg', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '22-Mar-22 11:11:29 AM' },
  { sCode: '4151', dCode: '41-51-248', name: 'Thiophanate Methyl 70% WP', packing: 25.00, unit: 'kg', ppc: 1, mType: 'Fungicides', type: 'RM', ts: '25-May-23 2:21:18 PM' },
  { sCode: '4151', dCode: '41-51-208', name: 'Trichlorfon 80% SP', packing: 25.00, unit: 'kg', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '22-Mar-22 11:11:07 AM' },
  { sCode: '4151', dCode: '41-51-242', name: 'Trip', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '10-May-23 12:50:36 PM' },
  { sCode: '4151', dCode: '41-51-251', name: 'Winsta', packing: 25.00, unit: 'kg', ppc: 1, mType: 'Herbicides', type: 'RM', ts: '10-Jul-23 12:20:10 PM' },
  { sCode: '4151', dCode: '41-51-233', name: 'Woolmer', packing: 200.00, unit: 'ltr', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '25-Mar-23 10:23:00 AM' },
  { sCode: '4151', dCode: '41-51-236', name: 'Yinongly', packing: 25.00, unit: 'kg', ppc: 1, mType: 'Insecticides', type: 'RM', ts: '09-Apr-23 11:57:12 AM' },
];

