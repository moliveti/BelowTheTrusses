/**
 * Modular contract schedule library.
 *
 * Comparing Below the Trusses' real signed contracts (Genners — Residential,
 * the furniture-inclusive template, Bethany Primitive Baptist Church —
 * Commercial) showed they are not one template with fields swapped in: they
 * are two structurally distinct document families with different schedule
 * sets, different schedule lettering, and different boilerplate text.
 *
 * - The Residential/Furniture family shares nearly-identical legal
 *   boilerplate (Design Concept Services, Project Administration Services,
 *   Termination Rights, Dispute Resolution, Additional Terms and
 *   Conditions) and differs only in which schedules are included (Furniture
 *   adds Selection of Merchandise, Purchasing Services, and Terms and
 *   Conditions of Sale) and in the dynamic figures (fee, payments, rates).
 * - The Commercial family (the Bethany template) is its own distinct
 *   document end to end — different defined-terms structure, different
 *   Termination Rights (includes a Termination Fee), different Additional
 *   Terms text. It is not built from the same blocks.
 *
 * Bodies use {{TOKEN}} placeholders filled by fillTokens() at generation
 * time. Schedule letters are assigned sequentially by composeDocument()
 * based on which blocks are actually included for a given contract.
 */

export interface ScheduleBlock {
  key: string;
  title: string;
  body: string;
}

export interface ContractDocument {
  scheduleListTitle: string;
  schedules: { letter: string; title: string; body: string }[];
}

export function fillTokens(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => tokens[key] ?? "");
}

function letterFor(index: number): string {
  return String.fromCharCode("A".charCodeAt(0) + index);
}

function composeDocument(blocks: ScheduleBlock[], tokens: Record<string, string>): ContractDocument {
  return {
    scheduleListTitle: "CONTRACT SCHEDULES",
    schedules: blocks.map((b, i) => ({
      letter: letterFor(i),
      title: b.title,
      body: fillTokens(b.body, tokens),
    })),
  };
}

// ---------------------------------------------------------------------------
// Residential / Furniture family
// ---------------------------------------------------------------------------

const PRELIMINARY_PROJECT_INFO: ScheduleBlock = {
  key: "preliminary_project_info",
  title: "Preliminary Project Information",
  body: "{{SCOPE_OF_WORK}}\n\nBudget is {{BUDGET}}.",
};

const DESIGN_CONCEPT_SERVICES: ScheduleBlock = {
  key: "design_concept_services",
  title: "Design Concept Services",
  body: `1. On the basis of existing plans or measurements to be taken or confirmed by us, we will, as and where we deem it appropriate, perform the following services:
Conduct an initial design study of existing conditions.
Discuss with you your design preferences for each of the Project Areas.
Prepare drawings and other materials and provide samples as necessary to generally illustrate our suggested design concepts, including color schemes, interior finishes, wall coverings, floor coverings, ceiling treatments, and window treatments for your approval.
Prepare schematic plans for recommended cabinet work, decorative built-ins, and decorative details.
2. Our Design Documents that are prepared in this phase of the Project will illustrate our suggested design concepts and will be presented to you for your review and written approval.
3. The preparation of CAD drawings, elevations, renderings, or other detailed drawings for detailing, custom millwork, cabinetry, or furnishings are included as a design service under this Agreement.`,
};

const SELECTION_OF_MERCHANDISE: ScheduleBlock = {
  key: "selection_of_merchandise",
  title: "Selection of Merchandise",
  body: `1. Selection and Specification of Merchandise. We will, where noted in Scope of Work, perform the following services:
Select and source Merchandise for your Project.
Provide fabric samples, finish samples, photographs, or other visual illustrations of Merchandise for your consideration.
Provide written purchase specifications for approved Merchandise.
2. Installation. We will provide in the quote with new merchandise: drapery, rugs, art for delivery and installation.`,
};

const PURCHASING_SERVICES: ScheduleBlock = {
  key: "purchasing_services",
  title: "Purchasing Services",
  body: `1. Purchasing Services. We will provide the following purchasing services ("Purchasing Services") to you in accordance with the terms set forth below. All Merchandise and Decorative Installations sold by or through us are subject to "Terms and Conditions of Sale".
2. Proposals. Each item of Merchandise and Decorative Installations to be purchased by you will be specified in a written proposal ("Proposal") prepared by us and submitted in each instance for your approval. Each Proposal will describe the item or service to be purchased and its "Specified Price" to you.
3. Specified Price. Except as set forth below, the "Specified Price" of each item of Merchandise and Decorative Installations shall be our net cost for the item or service, plus our Purchasing Fee ({{PURCHASING_FEE_PERCENT}}%), plus any applicable delivery, insurance, handling charges, and sales tax.
4. Ordering and Payment. All Merchandise and Decorative Installations specified by us will, if you wish to purchase them, be purchased solely through us. No item can be ordered by us until the corresponding Proposal has been approved by you and returned to us with our required payment, which shall be ninety percent (90%) of the Specified Price. Proposals for fabrics, wallpaper, accessories, antiques, items purchased at retail stores and certain other items require full payment at time of signed Proposal. The balance of the Specified Price is payable at the earlier of (a) when the item is ready for delivery to and/or installation at your residence; (b) when the item is ready for delivery to a third party for further work; or (c) when the item is ready for delivery to a storage facility, upon rendition of our invoice.
5. Order Management. We will assist in (a) managing your orders and following up with vendors regarding any delays or errors in processing your orders; and (b) scheduling and coordinating deliveries with vendors to your residence, or if you are unable to take immediate delivery of any Merchandise or store such Merchandise at your home, to a storage facility that has been selected by you and with whom you have entered into a contract.
6. Merchandise Inspection. You will be responsible for receiving, uncrating, and inspecting Merchandise for any visible damage upon receipt.`,
};

const PROJECT_ADMINISTRATION_SERVICES: ScheduleBlock = {
  key: "project_administration_services",
  title: "Project Administration Services",
  body: "During the course of the Project, we will visit your residence from time to time as we deem necessary to see whether, in our opinion, the work of any contractor, subcontractor, or vendor is proceeding in general conformity with our Design Documents (\"Project Administration Services\"). We are not responsible, however, for the performance or timely completion of any of their work or of any materials or equipment furnished by them.",
};

const DESIGNER_COMPENSATION: ScheduleBlock = {
  key: "designer_compensation",
  title: "Designer Compensation",
  body: `1. Design Fee. For our services described above (collectively, "Included Services"), our fee will be {{DESIGN_FEE_WORDS}} ({{DESIGN_FEE_AMOUNT}}) dollars (the "Design Fee") payable in installments in accordance with the following:
{{PAYMENT_SCHEDULE_LINES}}

Our Design Fee does not include drafting time in connection with Custom Merchandise or any other service not specifically provided for within the Scope of Work. If we provide any services to you or on your behalf outside of those Included Services, time expended by us will be billed to you at our Hourly Rates set forth below.

{{PM_FEE_CLAUSE}}

Our Hourly Rates ("Hourly Rates") are as follows:
Principal			{{HOURLY_RATE}} per hour
We reserve the right to adjust our Hourly Rates on an annual basis. Hourly Rates are in addition to all other fees and costs payable by you under this Agreement, and will be invoiced to you monthly.

2. All of our invoices are payable upon receipt. Any amounts owed by you to us that are not paid when due are subject to an interest charge computed at an annual rate equal to twenty percent (20%) (or the highest percentage rate permitted by law, if lower). In addition, we may suspend our services to you and/or withhold any item of Merchandise until payment has been made in full. Please note that all Designer compensation and all Reimbursable Expenses are subject to applicable state and local sales and excise tax (and similar taxes) and you agree to pay these taxes.`,
};

const TERMS_AND_CONDITIONS_OF_SALE: ScheduleBlock = {
  key: "terms_and_conditions_of_sale",
  title: "Terms and Conditions of Sale",
  body: `The following terms and conditions of sale ("Terms and Conditions") will be applicable to all Merchandise purchased by you pursuant to our Proposals, purchase orders, invoices or other order documents.

Price Changes. Proposal prices are adhered to as much as possible; however, we reserve the right to increase your price to reflect supplier increases, shipping costs, and currency exchange rates. We will notify you of any price increases, and when the price increases by more than ten percent (10%) over the original Proposal price, we will obtain your written approval prior to purchase.

No Cancellations or Returns. All Proposals approved by you in writing are non-cancelable unless we expressly agree to any such cancellation in writing. We will not, under any circumstances, accept cancellation of any custom or special order.

Failure to Make Payments when Due. Should you fail to make any payment due to us, we shall have the right to withhold delivery of any item of Merchandise and/or suspend performance of any service.

EXCLUSION OF WARRANTIES. We do not make any representations or warranties of any kind regarding any Merchandise. ALL WARRANTIES, EITHER EXPRESS OR IMPLIED, ARE EXPRESSLY EXCLUDED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.

Limitation of Liability. In no event shall we be liable for any consequential or incidental damages. In no event shall our liability arising out of your purchase of any item of Merchandise, for any reason, exceed the amount actually paid by you to us for the concerned item.`,
};

const TERMINATION_RIGHTS: ScheduleBlock = {
  key: "termination_rights",
  title: "Termination Rights",
  body: `1. Termination for Cause. This Agreement may be terminated by either party upon the other party's default in performance, provided that the terminating party provides the defaulting party with written Notice specifying the nature and extent of default, and the defaulting party fails to cure the default within twenty (20) days after receiving the written Notice. Termination for cause shall be without prejudice to any and all other rights and remedies that we may have, and in such event, you shall remain liable for all outstanding obligations owed by you to us.

2. Your Right to Terminate Without Cause. You may, upon ten (10) days written Notice to us, terminate this Agreement for any reason. Should you terminate this Agreement, you will remain financially obligated and responsible for all services completed, all Merchandise and Decorative Installations ordered, and all other commitments to us and to third parties that are set forth in signed Proposals. Termination shall be without prejudice to any and all other of our rights and remedies owed to us.`,
};

const DISPUTE_RESOLUTION: ScheduleBlock = {
  key: "dispute_resolution",
  title: "Dispute Resolution",
  body: `1. Arbitration. Any controversy, claim or dispute arising out of or relating to this Agreement, or the breach thereof, shall be decided by arbitration only in the city of Jacksonville, in the State of Florida, administered by (the "Arbitrator") in accordance with the rules of the Arbitrator then in effect, and judgment upon the award rendered by the Arbitrator may be entered in any court having jurisdiction thereof.

2. Choice of Law. This Agreement shall be construed in accordance with and governed by the laws of the state of Florida, without regard to conflict of laws principles.

3. Mediation. Notwithstanding the language set forth in Paragraph 1 above, in the event of any dispute between the parties, each party agrees first to try in good faith to settle the dispute through mediation administered by a Mediator in the city of Jacksonville, in the State of Florida, under its applicable mediation procedures then in effect, or any other mediation provider agreed to in a writing signed by both parties before resorting to arbitration.`,
};

const ADDITIONAL_TERMS_AND_CONDITIONS: ScheduleBlock = {
  key: "additional_terms_and_conditions",
  title: "Additional Terms and Conditions",
  body: `1. Design Documents. All of the drawings, specifications, plans, sketches, and other documents prepared by us for your Project (our "Design Documents") are conceptual in nature and intended to set forth our design intent only. We do not and are unable to perform architectural, engineering, or construction services.

2. Use of Design Related Professionals and Third Parties. Should the nature of our Design Documents require the services of third-party professionals, consultants, or contractors ("Design Related Professionals") or other third parties to perform work based upon our Design Documents, you agree to enter into separate agreements directly with each of them.

3. Your Responsibilities to Us. In order to provide you with services, you agree to provide us with access to the Project site as well as all information we may need to complete the Project. It is your responsibility to obtain all approvals required by any governmental agency or otherwise in connection with this Project.

{{INDEPENDENT_PURCHASES_CLAUSE}}

4. Reimbursable Expenses. Out-of-pocket expenses actually and reasonably incurred by us in the interests of your Project or on your behalf will be submitted to you for reimbursement and are payable upon receipt of our invoices. Reimbursable Expenses will be invoiced to you on a monthly basis.

5. Ownership and Use of Design Documents. All of our Design Documents that are prepared or furnished by us are owned by us and will be our exclusive property at all times, and we will retain all intellectual property rights and proprietary rights, including copyrights and trademarks, in and to these documents.

6. Indemnification. To the fullest extent permitted by law, you agree to indemnify and hold us harmless from and against any and all third-party claims, losses, liabilities, damages, costs, and expenses relating to, arising out of or resulting from the actions and omissions of you and/or of any Design Related Professional, contractor, subcontractor, vendor, or other third party hired or otherwise retained by you or on your behalf.

7. Limitation of Liability. To the fullest extent permitted by law, our total liability to you in regard to any and all claims, losses, and damages arising out of, relating to or resulting from this Agreement, shall not for any reason exceed the greater of (i) the total amount of Design Fees and other Designer compensation actually paid to us pursuant to this Agreement; or (ii) the available proceeds of our insurance policies, if any. No action against us for breach of this Agreement or otherwise may be brought more than one (1) year after the date of the accrual of such cause of action.

8. Consent to Photograph Project. As we require a permanent record of our design projects, you will permit us or our representatives to photograph, video and/or otherwise record images of the Project Areas and your residence before, during, and after Project completion. If any Project-related Photograph(s) are published by us, we will not identify your name and address in any such publication without your prior written consent.

This Agreement can be modified only by a writing that specifically states that it is amending this Agreement and is signed by an authorized representative of each of us. This Agreement is a complete statement of our understanding; no other representations or agreements have been made other than those contained in this Agreement.`,
};

const INDEPENDENT_PURCHASES_CLAUSE =
  "3a. Independent Purchases. All materials, lighting, appliances, etc. to be purchased by the client.";

export interface ResidentialFurnitureInput {
  scopeOfWork: string;
  budget: string;
  designFeeWords: string;
  designFeeAmount: string;
  paymentScheduleLines: string;
  hourlyRate: string;
  pmFeeClause: string;
  includeFurnitureSchedules: boolean;
  purchasingFeePercent: string;
}

export function buildResidentialFurnitureContract(input: ResidentialFurnitureInput): ContractDocument {
  const blocks: ScheduleBlock[] = [PRELIMINARY_PROJECT_INFO, DESIGN_CONCEPT_SERVICES];
  if (input.includeFurnitureSchedules) blocks.push(SELECTION_OF_MERCHANDISE, PURCHASING_SERVICES);
  blocks.push(PROJECT_ADMINISTRATION_SERVICES, DESIGNER_COMPENSATION);
  if (input.includeFurnitureSchedules) blocks.push(TERMS_AND_CONDITIONS_OF_SALE);
  blocks.push(TERMINATION_RIGHTS, DISPUTE_RESOLUTION, ADDITIONAL_TERMS_AND_CONDITIONS);

  return composeDocument(blocks, {
    SCOPE_OF_WORK: input.scopeOfWork,
    BUDGET: input.budget,
    DESIGN_FEE_WORDS: input.designFeeWords,
    DESIGN_FEE_AMOUNT: input.designFeeAmount,
    PAYMENT_SCHEDULE_LINES: input.paymentScheduleLines,
    HOURLY_RATE: input.hourlyRate,
    PM_FEE_CLAUSE: input.pmFeeClause,
    PURCHASING_FEE_PERCENT: input.purchasingFeePercent,
    INDEPENDENT_PURCHASES_CLAUSE: input.includeFurnitureSchedules ? "" : INDEPENDENT_PURCHASES_CLAUSE,
  });
}

// ---------------------------------------------------------------------------
// Commercial family (Bethany template) -- its own distinct document, not
// composed from the blocks above.
// ---------------------------------------------------------------------------

const COMMERCIAL_PARTIES_AND_PROJECT: ScheduleBlock = {
  key: "parties_and_project",
  title: "The Parties and the Project",
  body: `1. THE PARTIES AND THE PROJECT
The date of this Agreement is: {{AGREEMENT_DATE}}

The Client and Project Location is:
{{CLIENT_NAME}}
{{PROJECT_ADDRESS}}

The Designer is:
Below the Trusses
1777 Loquat Lane
Jacksonville, FL 32246

The Project is more particularly described as follows:
{{SCOPE_OF_WORK}}

2. PROJECT TEAM
Interior Designer & Purchasing Agent: Below the Trusses`,
};

const COMMERCIAL_DEFINITIONS: ScheduleBlock = {
  key: "definitions",
  title: "Definitions",
  body: `When used in this Agreement and in any addenda or schedule to this Agreement, the following terms shall have the meanings set forth below.

Client. The Person identified as the Client in Schedule A to this Agreement.
Design Services Fee. Compensation payable by the Client to the Designer for the Included Design Services.
Hourly Rates. The hourly compensation rate charged to the Client for Interior Design Services billed on an hourly basis.
Initial Payment. The payment to be paid by Client immediately upon the Client's signing of this Agreement.
Included Design Services. The Interior Design Services to be performed by the Designer on behalf of the Client as more particularly defined in the Designer Compensation schedule.
Procurement Fee. Compensation to the Designer for purchasing services, in addition to the Design Services Fee and all other compensation due to Designer.
Project FF&E. The Designer-selected and/or custom-fabricated furniture, furnishings, and equipment for the Project.
Substantial Completion. That time when the Included Design Services have been significantly completed by the Designer, notwithstanding any minor punch-list items that remain.
Termination Fee. Compensation to the Designer for the early termination of the Project by the Client, as set forth in the Termination Rights schedule.`,
};

const COMMERCIAL_PROJECT_PROGRAM: ScheduleBlock = {
  key: "project_program",
  title: "Project Program",
  body: `In this phase of the Project, the Designer will, as and where the Designer deems appropriate, perform the following services:
Meet with the Client or Client Representative for the purpose of understanding the Client Program.
Review the existing building plans, if any, of the Project Site.
Review, for aesthetic purposes, all drawings and plans, if any, submitted to the Client by any Third-Party Professional.
Prepare and submit to the Client for the Client's approval a written summary of the Client Program.`,
};

const COMMERCIAL_FFE_SELECTION: ScheduleBlock = {
  key: "ffe_selection",
  title: "Project FF&E Selection and Specification",
  body: `1. Designer will, as and where the Designer deems appropriate, perform the following services regarding the selection and specification of Project FF&E:
Select and/or design the Project FF&E.
Review the recommended Project FF&E with the Client and provide the Client with a preliminary budget estimate.
When all selections of the Project FF&E are finalized, provide written purchase specifications for approved merchandise.
2. During final installation of the Project FF&E, the Designer will, if requested by the Client, visit the Project Site to assist in the placement of the Project FF&E.
3. At the time of final installation, the Designer will prepare a punch list to describe what Project FF&E remains incomplete or nonconforming to the Designer's design concepts.`,
};

const COMMERCIAL_PROJECT_ADMINISTRATION: ScheduleBlock = {
  key: "project_administration",
  title: "Project Administration",
  body: "During the course of the Project, the Designer will make periodic visits to the Project Site, as the Designer considers appropriate, to observe the work of the Contractors to determine whether, in the Designer's opinion, such work is proceeding in general conformity with the design intent of the Project Documents. The Designer is not responsible for the performance, quality, timely completion, or delivery of any work, materials, or equipment furnished by any Contractor, Subcontractor, Vendor, or other third party.",
};

const COMMERCIAL_PURCHASING_SERVICES: ScheduleBlock = {
  key: "purchasing_services",
  title: "Purchasing Services",
  body: `1. The Designer will provide purchasing services as the Client's disclosed Purchasing Agent. All Project FF&E specified by Designer shall, if Client wishes to purchase them, be purchased solely through Designer.
2. Purchase Orders. Designer will prepare Purchase Orders for each item of Project FF&E to be purchased, and submit them to the Client for written approval.
3. Ordering and Payment. Upon Designer's receipt of the signed and approved Purchase Order, together with payment, Designer will place orders on behalf of the Client. Installation costs are due once product is delivered and installed.
4. Order Management. Designer will oversee and endeavor to expedite shipping arrangements for all Project FF&E purchased on behalf of the Client.`,
};

const COMMERCIAL_DESIGNER_COMPENSATION: ScheduleBlock = {
  key: "designer_compensation",
  title: "Designer Compensation",
  body: `1. Included Design Services. For the Included Design Services, the Client agrees to compensate the Designer in the amount of {{DESIGN_FEE_WORDS}} ({{DESIGN_FEE_AMOUNT}}) dollars. This Design Services Fee shall be payable by Client as follows:

{{PAYMENT_SCHEDULE_LINES}}

Notwithstanding the foregoing, if Designer's services are substantially completed on or before the date the final payment is due, Client shall pay any remaining unpaid balance of the Design Services Fee upon receipt of Designer's invoice.

2. Additional Design Services. The Client agrees to pay to the Designer an "Additional Services Fee" for any time spent performing services that are not Included Design Services, billed at the following Hourly Rates:
Principal    {{HOURLY_RATE}} per hour

{{PM_FEE_CLAUSE}}

Hourly Rates are in addition to all other fees and costs payable by Client under this Agreement, and are subject to annual increase.

3. Taxes. All compensation paid to Designer and all Reimbursable Expenses are subject to applicable state and local sales and excise tax and Client agrees to pay such taxes.`,
};

const COMMERCIAL_TERMINATION_RIGHTS: ScheduleBlock = {
  key: "termination_rights",
  title: "Termination Rights",
  body: `1. Termination for Cause. This Agreement may be terminated by either the Client or the Designer upon the other party's default in performance, provided that termination may not be effected unless written notice specifying the nature and extent of default is given, and such party fails to cure such default within ten (10) days from the date of receipt of such notice.

2. Client's Right to Terminate. The Client may, upon ten (10) days written prior notice to the Designer, terminate this Agreement without cause. The Client shall remain liable for all outstanding Design Services Fees and other compensation owed to the Designer.

3. Termination Fee. If the Project is terminated by Client prior to the Client's written approval of the Design Development Documents, Client agrees to pay to Designer, as additional compensation, a Termination Fee equal to the greater of (A) fifty percent (50%) of the entire Design Services Fee, or (B) an amount equal to the number of hours expended by Designer for services rendered to the date of termination at the Hourly Rate.`,
};

const COMMERCIAL_CLAIMS_AND_DISPUTES: ScheduleBlock = {
  key: "dispute_resolution",
  title: "Dispute Resolution",
  body: `1. Arbitration. Any controversy, claim or dispute arising out of or relating to this Agreement, or the breach thereof, shall be decided by arbitration only in the city of Jacksonville in the State of Florida administered by an Arbitrator in accordance with the rules then in effect, and judgment upon the award rendered may be entered in any court having jurisdiction thereof.

2. Choice of Law. This Agreement shall be construed in accordance with and governed by the laws of the State of Florida, without regard to conflict of laws principles.

3. Mediation. Notwithstanding the language set forth in Paragraph One above, in the event of any dispute between the parties, and before initiating an arbitration proceeding, each party agrees first to try in good faith to settle the dispute through mediation in the city of Jacksonville, in the State of Florida, before resorting to arbitration.`,
};

const COMMERCIAL_ADDITIONAL_TERMS: ScheduleBlock = {
  key: "additional_terms_and_conditions",
  title: "Additional Terms and Conditions",
  body: `The Client shall be responsible for (i) identifying all structural, electrical, mechanical, or physical elements affecting the Project; (ii) determining local building codes and other governmental requirements; and (iii) complying with applicable codes and obtaining all approvals required by any governmental agency in connection with the Project.

The Designer does not under any circumstances provide architectural, engineering, or construction services, and the Client will not use Project Documents for architectural, engineering, or construction purposes.

All Designer's invoices are payable upon receipt. Any amounts payable by the Client that are not paid when due are subject to an interest charge computed at an annual rate equal to twenty percent (20%) (or the highest percentage rate permitted by law, if lower).

Project Documents remain the Designer's exclusive property at all times and shall retain all intellectual property rights, including copyrights.

As the Designer requires a record of the Designer's design projects, the Client will permit the Designer to photograph, record on video, and/or otherwise record the Project and Project Site Work upon completion, for the Designer's business purposes, but the Designer shall not disclose the Project street address or the Client's name without the Client's prior written consent.

This Agreement is complete and an exclusive expression of the matters contained in this Agreement. No claim or action against the Designer arising out of or relating to this Agreement may be brought more than one (1) year after the date of the accrual of such cause of action.`,
};

const COMMERCIAL_SIGNATURES: ScheduleBlock = {
  key: "signatures",
  title: "Signatures",
  body: "The Persons signing this Agreement on behalf of the Client and the Designer respectively represent and warrant that such Person is duly authorized and has legal capacity to execute and deliver this Agreement.",
};

export interface CommercialInput {
  agreementDate: string;
  clientName: string;
  projectAddress: string;
  scopeOfWork: string;
  designFeeWords: string;
  designFeeAmount: string;
  paymentScheduleLines: string;
  hourlyRate: string;
  pmFeeClause: string;
}

export function buildCommercialContract(input: CommercialInput): ContractDocument {
  const blocks: ScheduleBlock[] = [
    COMMERCIAL_PARTIES_AND_PROJECT,
    COMMERCIAL_DEFINITIONS,
    COMMERCIAL_PROJECT_PROGRAM,
    COMMERCIAL_FFE_SELECTION,
    COMMERCIAL_PROJECT_ADMINISTRATION,
    COMMERCIAL_PURCHASING_SERVICES,
    COMMERCIAL_DESIGNER_COMPENSATION,
    COMMERCIAL_TERMINATION_RIGHTS,
    COMMERCIAL_CLAIMS_AND_DISPUTES,
    COMMERCIAL_ADDITIONAL_TERMS,
    COMMERCIAL_SIGNATURES,
  ];

  return composeDocument(blocks, {
    AGREEMENT_DATE: input.agreementDate,
    CLIENT_NAME: input.clientName,
    PROJECT_ADDRESS: input.projectAddress,
    SCOPE_OF_WORK: input.scopeOfWork,
    DESIGN_FEE_WORDS: input.designFeeWords,
    DESIGN_FEE_AMOUNT: input.designFeeAmount,
    PAYMENT_SCHEDULE_LINES: input.paymentScheduleLines,
    HOURLY_RATE: input.hourlyRate,
    PM_FEE_CLAUSE: input.pmFeeClause,
  });
}
