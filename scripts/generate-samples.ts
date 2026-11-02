/**
 * Generates synthetic messy legal documents for demonstration/testing.
 * Creates text files that simulate real-world messy documents.
 * For actual PDF generation, install pdfkit: npm install pdfkit @types/pdfkit
 */
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.resolve(__dirname, '../data/samples/input');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Sample 1: Clean complaint (text layer PDF simulation as .txt)
const cleanComplaint = `IN THE UNITED STATES DISTRICT COURT
FOR THE NORTHERN DISTRICT OF CALIFORNIA

SARAH JOHNSON and MICHAEL JOHNSON,
                    Plaintiffs,
    vs.
ACME CORPORATION, a Delaware corporation,
and JOHN DOE, individually,
                    Defendants.

Case No. 2024-CV-08472-NCA

COMPLAINT FOR DAMAGES AND INJUNCTIVE RELIEF

JURY TRIAL DEMANDED

Plaintiffs Sarah Johnson and Michael Johnson ("Plaintiffs") bring this action against
Defendants Acme Corporation and John Doe (collectively "Defendants") and allege as follows:

NATURE OF THE ACTION

1. This is an action for breach of contract, fraud, and violations of the California Business
   and Professions Code arising from Defendants' wrongful termination of the Master Service
   Agreement dated March 15, 2022 ("Agreement").

2. Plaintiffs seek compensatory damages in excess of $2,500,000, punitive damages,
   injunctive relief, and attorneys' fees.

PARTIES

3. Plaintiff Sarah Johnson is an individual residing in San Francisco, California.

4. Plaintiff Michael Johnson is an individual residing in San Francisco, California,
   and is the spouse of Sarah Johnson.

5. Defendant Acme Corporation is a corporation organized under the laws of Delaware,
   with its principal place of business at 500 Technology Drive, Palo Alto, California 94301.

6. Defendant John Doe is an individual who, at all relevant times, was the Chief Executive
   Officer of Acme Corporation and a resident of Palo Alto, California.

JURISDICTION AND VENUE

7. This Court has subject matter jurisdiction pursuant to 28 U.S.C. § 1332 (diversity of
   citizenship) as the amount in controversy exceeds $75,000 and there is complete diversity.

8. Venue is proper in this District pursuant to 28 U.S.C. § 1391(b) because a substantial
   part of the events or omissions giving rise to the claims occurred in this District.

FACTUAL ALLEGATIONS

9. On March 15, 2022, Plaintiffs and Acme Corporation entered into the Agreement for
   software development services valued at $3,200,000 over three years.

10. From March 2022 through December 2023, Plaintiffs fully performed all obligations
    under the Agreement, delivering software modules on time and within budget.

11. On January 5, 2024, Defendant John Doe sent Plaintiffs a written notice purporting to
    terminate the Agreement "for cause," citing alleged deficiencies in deliverable quality.

12. The alleged deficiencies were fabricated. All deliverables met the specifications set
    forth in Exhibit A to the Agreement, as confirmed by independent technical review
    conducted by TechAudit LLC on January 20, 2024.

13. Plaintiffs have suffered damages in excess of $2,500,000 representing lost contract
    payments, lost business opportunities, and reputational harm.

CAUSES OF ACTION

FIRST CAUSE OF ACTION — BREACH OF CONTRACT

14. Plaintiffs incorporate paragraphs 1 through 13 as though fully set forth herein.

15. A valid and enforceable contract existed between Plaintiffs and Acme Corporation.

16. Plaintiffs performed all conditions, covenants, and obligations required of them.

17. Defendants breached the Agreement by wrongfully terminating it without valid cause.

18. As a direct and proximate result, Plaintiffs suffered damages of at least $2,500,000.

SECOND CAUSE OF ACTION — FRAUD

19. Defendant John Doe knowingly made false representations about the quality of Plaintiffs'
    deliverables with intent to induce Plaintiffs to accept a lower settlement.

20. Plaintiffs were damaged by these fraudulent misrepresentations.

PRAYER FOR RELIEF

WHEREFORE, Plaintiffs pray for judgment as follows:
(a) Compensatory damages in an amount not less than $2,500,000;
(b) Punitive damages in an amount to be determined at trial;
(c) Injunctive relief preventing Defendants from further tortious interference;
(d) Reasonable attorneys' fees pursuant to the Agreement and applicable law;
(e) Costs of suit; and
(f) Such other and further relief as the Court deems just and proper.

JURY TRIAL DEMAND

Plaintiffs demand trial by jury on all issues so triable.

Dated: February 14, 2024

                    Respectfully submitted,
                    LAW OFFICES OF CHEN & PATEL LLP

                    By: ________________________
                    PRIYA PATEL (Bar No. 287341)
                    Attorney for Plaintiffs
                    123 Market Street, Suite 400
                    San Francisco, CA 94105
                    Tel: (415) 555-0100
`;

// Sample 2: Scanned order (simulated low-quality OCR output — messy)
const scannedOrder = `     C0URT 0RDER — MOTTON FOR SUMMARY JUDGMENT

CASE NO: 2024-CV-O8472-NCA [handwritten note: received Jan 30 2024]

IN THE MATTER OF: J0HNSON v. ACME C0RPORATION

DATE OF HEARING: January 25, 2O24 [O = zero in original scan]
PRESIDING: Hon. MARGARET L. RIVERS, U.S. District Judge

PRESENT:
  - Prlya Patel (Att0rney for Plaintiff, Chen & Patel LLP) [smudge]
  - David Ng, Esq. (Attorney for Def. Acme Corp) [torn edge]
  - Robert Sm1th (in-house counsel, Acme) [1 = i typo from scan]

THE COURT: Having considered Defendant's Motion for Summary Judgment
filed December 12, 2O23, Plaintiffs Opposition filed January 3, 2O24,
and oral argument heard this date, the Court hereby ORDERS as follows:

  1.  Defendant's Motion for Summary Judgment is DENIED IN PART and
      GRANTED IN PART as follows:
      a. DENIED as to Plaintiffs' breach of contract claims (Count l)
         [l = I = Roman numeral - scan artifact]
      b. DENIED as to Plaintiffs' fraud claims (Count ll)
      c. GRANTED as to Plaintiffs' punitive damages claim to the extent
         it relies solely on the breach of contract theory

  2.  The Court finds genuine issues of material fact exist regarding:
      — Whether Defendants had valid cause for termination under § 12.3
        of the Master Service Agreement
      — Whether the January 5, 2024 termination notice was proper
        [marginal note: "see TechAudit report"]

  3.  Trial date is set for JUNE 16, 2024 at 9:O0 AM in Courtroom 12.
      Pre-trial conference: MAY 28, 2O24 at 2:OO PM.

  4.  Discovery cutoff extended to APRIL 15, 2O24 [handwritten: per
      stipulation filed 1/27/24]

  5.  Defendant shall file a revised privilege log by FEBRUARY 28, 2024.

  IT IS SO ORDERED.

  Dated: January 25, 2024
                    /s/ Margaret L. Rivers
                    MARGARET L. RIVERS
                    United States District Judge
                    Northern District of California

[CLERK'S NOTE: Filed and entered January 25, 2024 — Dkt. No. 47]
[PAGE QUALITY: Poor — recommend re-scan pages 3-4 if available]
`;

// Sample 3: Handwritten notes simulation (partial, low confidence)
const handwrittenNotes = `[CASE NOTES — partially legible — OCR confidence ~55%]

Johnson v Acme - Pre-trial prep notes
Date: May 15, 2024 [?]

Key issues to address at trial:
1) Breach ? contract - main theory - strong
   Evidence: [scrawl] TechAudit report, emails Jan 2024
   Witness: [barely legible] Sarah J. + tech expert (name tbd?)

2) Damages calc:
   Lost payments: ~$1.8M (confirmed)
   Lost biz opport.: [smudged] $700K?? (need more support)
   Punitive: prob dismissed (see order Jan 25)

3) Defendant's defenses:
   - "for cause" termination - WEAK (TechAudit rebuts)
   - Limitation clause §14 in Agmt - need to argue around
   - Statute of lim[itations] -- should be ok, filed in time

Depo transcripts needed:
  - John Doe depo (Feb 28) - KEY - his knowledge of quality issues
  - Robert Smith depo (Mar 5) - corroborating
  - TechAudit expert (Apr 3) - confirm findings

[arrow pointing to margin] Check: did we file motion in limine re:
settlement negotiations? Rule 408 -- YES filed April 20 (Dkt 63)

VERDICT FORM: discuss w/ Priya -- need clear q's on:
  [illegible line] breach elements
  [illegible] damages itemized
  Actual vs. [smudge] damages
`;

// Sample 4: Inconsistent format mixed document
const inconsistentDoc = `STIPULATION AND [PROPOSED] ORDER
RE: DISCOVERY SCHEDULE

Case: Johnson et al. v. Acme Corporation et al., Case No. 2024-CV-08472
Court: U.S. District Court, N.D. Cal.
Judge: Hon. Margaret L. Rivers

IT IS HEREBY STIPULATED AND AGREED by and between counsel for all parties:

BACKGROUND
The parties entered into the Master Service Agreement on March 15, 2022.
Discovery is ongoing. Both parties wish to extend certain deadlines.

STIPULATED SCHEDULE MODIFICATIONS:

|  EVENT                          |  CURRENT DATE    |  NEW DATE        |
|-------------------------------|-----------------|-----------------|
|  Fact discovery cutoff        |  March 30, 2024  |  April 15, 2024  |
|  Expert disclosure (Plaintiff) |  April 5, 2024   |  April 20, 2024  |
|  Expert disclosure (Defense)   |  April 20, 2024  |  May 5, 2024     |
|  Rebuttal experts              |  May 1, 2024     |  May 15, 2024    |
|  Expert discovery cutoff      |  May 10, 2024    |  May 25, 2024    |
|  Dispositive motions          |  May 20, 2024    |  June 3, 2024    |

REASONS FOR MODIFICATION:
1. Defense counsel David Ng requires additional time due to scheduling conflict
2. Plaintiff's expert witness (TechAudit LLC - Dr. Rachel Kim) unavailable until April

AGREED:
Priya Patel, Esq.                    David Ng, Esq.
Chen & Patel LLP                     Ng & Associates
Attorney for Plaintiffs              Attorney for Defendants
Dated: January 27, 2024              Dated: January 27, 2024

IT IS SO ORDERED.
Dated: __________________
Hon. Margaret L. Rivers
U.S. District Judge

[METADATA: Filed: 2024-01-27 | DocType: Stipulation | CaseID: 2024-CV-08472]
[PARTIES: Johnson, Sarah; Johnson, Michael; Acme Corporation; Doe, John]
`;

const samples = [
  { name: 'sample-001_clean_complaint.txt', content: cleanComplaint },
  { name: 'sample-001_court_order.txt', content: scannedOrder },
  { name: 'sample-001_handwritten_notes.txt', content: handwrittenNotes },
  { name: 'sample-001_stipulation.txt', content: inconsistentDoc },
];

for (const sample of samples) {
  const filePath = path.join(OUTPUT_DIR, sample.name);
  fs.writeFileSync(filePath, sample.content);
  console.log(`Created: ${filePath}`);
}

// Create cases.json manifest
const casesManifest = {
  cases: [
    {
      caseId: 'sample-001',
      name: 'Johnson v. Acme Corporation',
      documents: samples.map(s => s.name),
      description: 'Breach of contract and fraud case in NDCA',
    },
  ],
};
fs.writeFileSync(path.join(OUTPUT_DIR, '../cases.json'), JSON.stringify(casesManifest, null, 2));
console.log('\nSample data generated successfully!');
console.log(`Run: npm run ingest -- --input ${OUTPUT_DIR}`);
