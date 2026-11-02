/**
 * Generates synthetic sample documents for demo mode.
 * Intentionally messy: OCR artifacts, scan markers, handwriting annotations.
 */
import * as fs from 'fs';
import * as path from 'path';
import { SAMPLES_INPUT } from '@/lib/backend-init';

// Reads the actual sample content from the root scripts/generate-samples.ts output.
// These are the same files the root npm run generate-samples creates.

const CLEAN_COMPLAINT = `IN THE UNITED STATES DISTRICT COURT
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

1. This is an action for breach of contract, fraud, and violations of the California Business
   and Professions Code arising from Defendants' wrongful termination of the Master Service
   Agreement dated March 15, 2022 ("Agreement").

2. Plaintiffs seek compensatory damages in excess of $2,500,000, punitive damages, and
   injunctive relief.

PARTIES

3. Plaintiff Sarah Johnson is an individual residing in San Francisco, California.
4. Plaintiff Michael Johnson is an individual residing in San Francisco, California.
5. Defendant Acme Corporation is a corporation organized under the laws of Delaware,
   with its principal place of business at 500 Technology Drive, Palo Alto, California 94301.
6. Defendant John Doe was the Chief Executive Officer of Acme Corporation.

JURISDICTION

7. Jurisdiction pursuant to 28 U.S.C. § 1332 (diversity; amount exceeds $75,000).
8. Venue proper in this District pursuant to 28 U.S.C. § 1391(b).

FACTS

9. On March 15, 2022, Plaintiffs and Acme Corporation entered into the Agreement for
   software development services valued at $3,200,000 over three years.

10. Plaintiffs fully performed all obligations, delivering software modules on time.

11. On January 5, 2024, Defendant John Doe sent a termination notice "for cause," citing
    alleged deficiencies in deliverable quality.

12. The alleged deficiencies were fabricated. TechAudit LLC confirmed on January 20, 2024
    that all deliverables met Exhibit A specifications.

13. Plaintiffs suffered damages in excess of $2,500,000.

CAUSES OF ACTION: Breach of Contract; Fraud.

PRAYER FOR RELIEF: Compensatory damages ($2,500,000+); Punitive damages; Injunctive relief;
Attorneys' fees; Costs.

Dated: February 14, 2024
By: Priya Patel (Bar No. 287341), Chen & Patel LLP`;

// Scanned court order — OCR artifacts: 0/O substitutions, smudge annotations, typos
const SCANNED_ORDER = `     C0URT 0RDER — MOTTON FOR SUMMARY JUDGMENT

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
the Court hereby ORDERS as follows:

  1. Defendant's Motion for Summary Judgment is DENIED IN PART and
     GRANTED IN PART as follows:
     a. DENIED as to Plaintiffs' breach of contract claims (Count l)
        [l = I = Roman numeral - scan artifact]
     b. DENIED as to Plaintiffs' fraud claims (Count ll)
     c. GRANTED as to Plaintiffs' punitive damages claim to the extent
        it relies solely on the breach of contract theory

  2. The Court finds genuine issues of material fact exist regarding:
     - Whether Defendants had valid cause for termination under § 12.3
     - Whether the January 5, 2024 termination notice was proper
       [marginal note: "see TechAudit report"]

  3. Trial: JUNE 16, 2024 at 9:O0 AM, Courtroom 12.
     Pre-trial conference: MAY 28, 2O24 at 2:OO PM.

  4. Discovery cutoff extended to APRIL 15, 2O24 [handwritten: per stipulation 1/27/24]
  5. Defendant shall file revised privilege log by FEBRUARY 28, 2024.

IT IS SO ORDERED. /s/ Margaret L. Rivers, U.S. District Judge
Dated: January 25, 2024 [Dkt. No. 47]
[PAGE QUALITY: Poor — recommend re-scan pages 3-4 if available]`;

// Handwritten notes — partial legibility, uncertainty markers
const HANDWRITTEN_NOTES = `[CASE NOTES — partially legible — OCR confidence ~55%]

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
  [illegible] damages itemized`;

const STIPULATION = `STIPULATION AND [PROPOSED] ORDER RE: DISCOVERY SCHEDULE

Case: Johnson et al. v. Acme Corporation, 2024-CV-08472
Court: U.S. District Court, N.D. Cal. / Judge: Hon. Margaret L. Rivers

STIPULATED SCHEDULE:
| EVENT                          | CURRENT DATE    | NEW DATE        |
|-------------------------------|-----------------|-----------------|
| Fact discovery cutoff         | March 30, 2024  | April 15, 2024  |
| Expert disclosure (Plaintiff) | April 5, 2024   | April 20, 2024  |
| Expert disclosure (Defense)   | April 20, 2024  | May 5, 2024     |
| Dispositive motions           | May 20, 2024    | June 3, 2024    |

REASONS: Defense counsel conflict; Plaintiff expert (Dr. Rachel Kim) unavailable.

Priya Patel, Esq. (Chen & Patel LLP) — Jan 27, 2024
David Ng, Esq. (Ng & Associates) — Jan 27, 2024

IT IS SO ORDERED. Hon. Margaret L. Rivers`;

export default async function generateSamples(): Promise<void> {
  fs.mkdirSync(SAMPLES_INPUT, { recursive: true });

  const samples = [
    { name: 'sample-001_clean_complaint.txt', content: CLEAN_COMPLAINT },
    { name: 'sample-001_court_order.txt', content: SCANNED_ORDER },
    { name: 'sample-001_handwritten_notes.txt', content: HANDWRITTEN_NOTES },
    { name: 'sample-001_stipulation.txt', content: STIPULATION },
  ];

  for (const s of samples) {
    fs.writeFileSync(path.join(SAMPLES_INPUT, s.name), s.content);
  }
}
