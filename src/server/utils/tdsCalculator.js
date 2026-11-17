/**
 * Indian Payroll and Finance TDS Calculation Engine
 * Compliant with the latest Income Tax Rules (including Budget 2024 and FY 2025-26 / FY 2026-27)
 */

class TDSCalculator {
  /**
   * Calculates TDS for a transaction based on the specified Section and rules.
   * @param {Object} params
   * @param {string} params.section - The TDS Section (e.g. '192', '194C', '194J')
   * @param {number} params.amount - Current transaction amount
   * @param {number} [params.aggregateAmount=0] - Aggregate payments to this payee in current FY (excluding current amount)
   * @param {boolean} [params.hasPan=true] - Whether valid PAN is provided by payee (Section 206AA check)
   * @param {string} [params.payeeType='INDIVIDUAL'] - INDIVIDUAL, HUF, COMPANY, FIRM, OTHERS
   * @param {boolean} [params.isSeniorCitizen=false] - Used for Section 194A senior thresholds
   * @param {boolean} [params.isFiler=true] - Has payee filed IT return in previous year (Section 206AB check)
   * @param {string} [params.subCategory] - Sub-types like 'TECHNICAL'/'PROFESSIONAL' (194J) or 'MACHINERY'/'LAND_BUILDING' (194I)
   * @param {Object} [params.salaryDetails] - Required if section is '192' (Salary)
   * @param {number} [params.salaryDetails.annualGross] - Annual gross salary
   * @param {string} [params.salaryDetails.regime='NEW'] - NEW or OLD tax regime
   * @param {number} [params.salaryDetails.deductions80C=0] - Total 80C deductions (max 1.5L, Old regime only)
   * @param {number} [params.salaryDetails.otherDeductions=0] - Other deductions (e.g. 80D, HRA, etc., Old regime only)
   * @returns {Object} JSON result containing calculations and rules applied
   */
  static calculate(params) {
    const {
      section,
      amount,
      aggregateAmount = 0,
      hasPan = true,
      payeeType = 'INDIVIDUAL',
      isSeniorCitizen = false,
      isFiler = true,
      subCategory = null,
      salaryDetails = {}
    } = params;

    const totalFYAmount = aggregateAmount + amount;
    let applicableRate = 0;
    let thresholdExceeded = false;
    let reason = "";
    let sectionName = "";

    // General PAN rule: If no PAN, apply higher of (2 * normal rate) or 20% (except 194Q which is 5%)
    // General Non-Filer rule (Sec 206AB): If non-filer, apply higher of (2 * normal rate) or 5%
    const applyPenaltyRates = (normalRate) => {
      let rate = normalRate;
      
      // 1. Check Section 206AB (Non-filer)
      if (!isFiler && !['192', '192A', '194B', '194BB', '194N'].includes(section)) {
        const doubleRate = normalRate * 2;
        rate = Math.max(doubleRate, 5);
        reason += "[Sec 206AB: Non-filer penalty applied] ";
      }

      // 2. Check Section 206AA (No PAN)
      if (!hasPan) {
        const noPanLimit = (section === '194Q') ? 5 : 20;
        rate = Math.max(rate, noPanLimit);
        reason += `[Sec 206AA: No PAN penalty applied - min ${noPanLimit}%] `;
      }

      return rate;
    };

    switch (section) {
      case '192': {
        sectionName = "Salary (Section 192)";
        thresholdExceeded = true; // Slabs evaluated annually
        const taxDetails = this.calculateSalaryTax(salaryDetails);
        applicableRate = taxDetails.effectiveRate;
        const totalAnnualTDS = taxDetails.totalTax;
        
        // TDS is usually deducted monthly (divide annual tax by 12)
        const tdsAmount = Math.round((totalAnnualTDS / 12) * 100) / 100;
        const netPayable = amount - tdsAmount;

        return {
          section: "192",
          transactionType: "Salary Disbursement",
          applicableRate: `${applicableRate.toFixed(2)}%`,
          tdsAmount: tdsAmount,
          netPayableAmount: Math.round(netPayable * 100) / 100,
          reason: `Annual Taxable Income: ₹${taxDetails.taxableIncome.toLocaleString()}. Annual Tax liability: ₹${totalAnnualTDS.toLocaleString()} (${salaryDetails.regime} Regime). Deducted monthly.`,
          breakdown: taxDetails
        };
      }

      case '192A': {
        sectionName = "EPF Withdrawal (Section 192A)";
        const threshold = 50000;
        if (totalFYAmount >= threshold) {
          thresholdExceeded = true;
          const normalRate = 10;
          // Note: If no PAN, rate is 20% (MMR was reduced to 20% by Finance Act 2023)
          applicableRate = hasPan ? normalRate : 20;
          if (!hasPan) reason += "[Sec 206AA: No PAN penalty applied] ";
        } else {
          reason = `Aggregate withdrawal amount (₹${totalFYAmount}) is below the threshold of ₹${threshold}.`;
        }
        break;
      }

      case '193': {
        sectionName = "Interest on Securities (Section 193)";
        const threshold = 10000; // General debenture threshold
        if (totalFYAmount > threshold) {
          thresholdExceeded = true;
          applicableRate = applyPenaltyRates(10);
        } else {
          reason = `Aggregate interest (₹${totalFYAmount}) is below the threshold of ₹${threshold}.`;
        }
        break;
      }

      case '194': {
        sectionName = "Dividend (Section 194)";
        const threshold = 5000;
        if (totalFYAmount > threshold) {
          thresholdExceeded = true;
          applicableRate = applyPenaltyRates(10);
        } else {
          reason = `Aggregate dividend (₹${totalFYAmount}) is below the threshold of ₹${threshold}.`;
        }
        break;
      }

      case '194A': {
        sectionName = "Interest Other Than Securities (Section 194A)";
        const threshold = isSeniorCitizen ? 50000 : 40000; // Seniors: 50k, Others: 40k for banks. Non-banks: 5k.
        if (totalFYAmount > threshold) {
          thresholdExceeded = true;
          applicableRate = applyPenaltyRates(10);
        } else {
          reason = `Aggregate interest (₹${totalFYAmount}) is below the threshold of ₹${threshold} for ${isSeniorCitizen ? 'Senior Citizen' : 'Individual'}.`;
        }
        break;
      }

      case '194B': {
        sectionName = "Lottery/Puzzle Winnings (Section 194B)";
        const threshold = 10000;
        if (amount > threshold) {
          thresholdExceeded = true;
          applicableRate = 30; // Flat 30% (no surcharge/cess for domestic unless non-resident, cess is usually handled at filing except for salaries)
        } else {
          reason = `Winnings amount (₹${amount}) is below the threshold of ₹${threshold}.`;
        }
        break;
      }

      case '194BB': {
        sectionName = "Horse Race Winnings (Section 194BB)";
        const threshold = 10000;
        if (amount > threshold) {
          thresholdExceeded = true;
          applicableRate = 30;
        } else {
          reason = `Winnings amount (₹${amount}) is below the threshold of ₹${threshold}.`;
        }
        break;
      }

      case '194C': {
        sectionName = "Contractor Payments (Section 194C)";
        // Single contract threshold > 30k OR aggregate FY > 1L
        const singleExceeded = amount > 30000;
        const aggregateExceeded = totalFYAmount > 100000;
        
        if (singleExceeded || aggregateExceeded) {
          thresholdExceeded = true;
          const normalRate = (payeeType === 'INDIVIDUAL' || payeeType === 'HUF') ? 1 : 2;
          applicableRate = applyPenaltyRates(normalRate);
          reason += `Threshold exceeded: ${singleExceeded ? 'Single payment > ₹30,000' : 'Aggregate FY payments > ₹1,00,000'}.`;
        } else {
          reason = `Payment is below single threshold (₹30,000) and aggregate FY payments (₹${totalFYAmount}) are below ₹1,00,000.`;
        }
        break;
      }

      case '194D': {
        sectionName = "Insurance Commission (Section 194D)";
        const threshold = 15000;
        if (totalFYAmount > threshold) {
          thresholdExceeded = true;
          // Rate is 5% for individuals, 10% for companies, but if user requested 2%, let's support 2% or default to 2% as per spec.
          const normalRate = 2; // User requested 2%. (Standard: 5% for individuals)
          applicableRate = applyPenaltyRates(normalRate);
        } else {
          reason = `Aggregate commission (₹${totalFYAmount}) is below the threshold of ₹${threshold}.`;
        }
        break;
      }

      case '194G': {
        sectionName = "Lottery Commission (Section 194G)";
        const threshold = 15000;
        if (totalFYAmount > threshold) {
          thresholdExceeded = true;
          const normalRate = 2; // Reduced from 5% by Budget 2024
          applicableRate = applyPenaltyRates(normalRate);
        } else {
          reason = `Aggregate commission (₹${totalFYAmount}) is below the threshold of ₹${threshold}.`;
        }
        break;
      }

      case '194H': {
        sectionName = "Commission or Brokerage (Section 194H)";
        const threshold = 15000;
        if (totalFYAmount > threshold) {
          thresholdExceeded = true;
          const normalRate = 2; // Reduced from 5% by Budget 2024
          applicableRate = applyPenaltyRates(normalRate);
        } else {
          reason = `Aggregate commission/brokerage (₹${totalFYAmount}) is below the threshold of ₹${threshold}.`;
        }
        break;
      }

      case '194I': {
        sectionName = "Rent (Section 194I)";
        const threshold = 240000; // Annual threshold
        if (totalFYAmount > threshold) {
          thresholdExceeded = true;
          const normalRate = (subCategory === 'MACHINERY') ? 2 : 10; // Machinery: 2%, Land/Building/Furniture: 10%
          applicableRate = applyPenaltyRates(normalRate);
          reason += `Aggregate annual rent (₹${totalFYAmount}) exceeds threshold of ₹${threshold} (Rent category: ${subCategory || 'LAND_BUILDING'}).`;
        } else {
          reason = `Aggregate annual rent (₹${totalFYAmount}) is below the threshold of ₹${threshold}.`;
        }
        break;
      }

      case '194J': {
        sectionName = "Professional/Technical Fees (Section 194J)";
        const threshold = 30000;
        // Exception: Director's fee has NO threshold.
        const isDirectorFee = subCategory === 'DIRECTOR_FEE';
        
        if (totalFYAmount > threshold || isDirectorFee) {
          thresholdExceeded = true;
          // Technical services/Royalty (cinematographic)/Call centre: 2%
          // Professional services/Non-compete fees/Director fees: 10%
          const normalRate = (subCategory === 'TECHNICAL' || subCategory === 'CALL_CENTRE') ? 2 : 10;
          applicableRate = applyPenaltyRates(normalRate);
          reason += isDirectorFee ? "Applied to Director's fees (exempt from threshold check)." : `Aggregate fees (₹${totalFYAmount}) exceeds threshold of ₹${threshold}.`;
        } else {
          reason = `Aggregate professional fees (₹${totalFYAmount}) are below the threshold of ₹${threshold}.`;
        }
        break;
      }

      case '194K': {
        sectionName = "Mutual Fund Income (Section 194K)";
        const threshold = 5000;
        if (totalFYAmount > threshold) {
          thresholdExceeded = true;
          applicableRate = applyPenaltyRates(10);
        } else {
          reason = `Aggregate MF income (₹${totalFYAmount}) is below the threshold of ₹${threshold}.`;
        }
        break;
      }

      case '194N': {
        sectionName = "Cash Withdrawal (Section 194N)";
        // Active filers threshold: 1 Crore (rate 2% on excess)
        // Non-filers threshold: 20 Lakhs (2% between 20L and 1Cr, 5% above 1Cr)
        if (isFiler) {
          const threshold = 10000000; // 1 Crore
          if (totalFYAmount > threshold) {
            thresholdExceeded = true;
            applicableRate = 2;
            reason = `Filer aggregate cash withdrawal (₹${totalFYAmount}) exceeds ₹1 Crore. TDS applies at 2% on excess.`;
          } else {
            reason = `Filer aggregate cash withdrawal (₹${totalFYAmount}) is below threshold of ₹1 Crore.`;
          }
        } else {
          const threshold20L = 2000000; // 20 Lakhs
          const threshold1Cr = 10000000; // 1 Crore
          if (totalFYAmount > threshold1Cr) {
            thresholdExceeded = true;
            applicableRate = 5;
            reason = `Non-filer aggregate cash withdrawal (₹${totalFYAmount}) exceeds ₹1 Crore. TDS applies at 5% on excess.`;
          } else if (totalFYAmount > threshold20L) {
            thresholdExceeded = true;
            applicableRate = 2;
            reason = `Non-filer aggregate cash withdrawal (₹${totalFYAmount}) exceeds ₹20 Lakhs. TDS applies at 2% on excess.`;
          } else {
            reason = `Non-filer aggregate cash withdrawal (₹${totalFYAmount}) is below threshold of ₹20 Lakhs.`;
          }
        }
        break;
      }

      case '194O': {
        sectionName = "E-commerce Transactions (Section 194O)";
        // Threshold: ₹5,00,000 for Individual/HUF sellers. Others: No threshold.
        const hasThreshold = payeeType === 'INDIVIDUAL' || payeeType === 'HUF';
        const threshold = 500000;
        
        if (!hasThreshold || totalFYAmount > threshold) {
          thresholdExceeded = true;
          const normalRate = 0.1; // Reduced from 1% by Budget 2024
          applicableRate = applyPenaltyRates(normalRate);
        } else {
          reason = `Seller is ${payeeType} and aggregate transactions (₹${totalFYAmount}) are below the threshold of ₹${threshold}.`;
        }
        break;
      }

      case '194Q': {
        sectionName = "Purchase of Goods (Section 194Q)";
        // Threshold: ₹50,00,000 in current FY (TDS on excess).
        // Applicable only if Buyer's turnover > 10 Crore in previous FY (assumed here).
        const threshold = 5000000;
        if (totalFYAmount > threshold) {
          thresholdExceeded = true;
          const normalRate = 0.1;
          applicableRate = applyPenaltyRates(normalRate);
          reason += `Aggregate purchases (₹${totalFYAmount}) exceed threshold of ₹50 Lakhs. TDS applies on excess.`;
        } else {
          reason = `Aggregate purchases (₹${totalFYAmount}) are below the threshold of ₹50 Lakhs.`;
        }
        break;
      }

      case '194R': {
        sectionName = "Business benefits or perquisites (Section 194R)";
        const threshold = 20000;
        if (totalFYAmount > threshold) {
          thresholdExceeded = true;
          applicableRate = applyPenaltyRates(10);
        } else {
          reason = `Aggregate benefits value (₹${totalFYAmount}) is below the threshold of ₹${threshold}.`;
        }
        break;
      }

      case '194S': {
        sectionName = "Virtual Digital Assets/Cryptocurrency (Section 194S)";
        // Threshold: ₹50,000 for Specified Persons (Individuals/HUF with no business turnover or business < 1Cr/50L).
        // Threshold: ₹10,000 for others. Let's use 10,000 default or 50,000 if payeeType is INDIVIDUAL.
        const threshold = (payeeType === 'INDIVIDUAL' || payeeType === 'HUF') ? 50000 : 10000;
        if (totalFYAmount > threshold) {
          thresholdExceeded = true;
          applicableRate = applyPenaltyRates(1);
        } else {
          reason = `Aggregate VDA transactions (₹${totalFYAmount}) are below the threshold of ₹${threshold}.`;
        }
        break;
      }

      case '194T': {
        sectionName = "Partnership Payments to Partners (Section 194T)";
        const threshold = 20000;
        if (totalFYAmount > threshold) {
          thresholdExceeded = true;
          applicableRate = applyPenaltyRates(10);
        } else {
          reason = `Aggregate payments to partner (₹${totalFYAmount}) are below the threshold of ₹${threshold}.`;
        }
        break;
      }

      default:
        throw new Error(`Unsupported or invalid TDS Section code: ${section}`);
    }

    // Evaluate final TDS amount
    let tdsAmount = 0;
    if (thresholdExceeded) {
      // For Section 194Q (Purchase of Goods) and 194N (Cash Withdrawal), TDS is only on the excess amount
      if (section === '194Q') {
        const threshold = 5000000;
        const previouslyTaxed = Math.max(0, aggregateAmount - threshold);
        const currentTaxable = Math.max(0, totalFYAmount - threshold) - previouslyTaxed;
        tdsAmount = (currentTaxable * applicableRate) / 100;
      } else if (section === '194N') {
        const threshold = isFiler ? 10000000 : 2000000;
        const previouslyTaxed = Math.max(0, aggregateAmount - threshold);
        const currentTaxable = Math.max(0, totalFYAmount - threshold) - previouslyTaxed;
        tdsAmount = (currentTaxable * applicableRate) / 100;
      } else {
        tdsAmount = (amount * applicableRate) / 100;
      }
      reason = reason || `TDS applied under ${sectionName} at normal rate.`;
    } else {
      reason = reason || `Below threshold limits. No TDS deducted.`;
    }

    // Format final currency outputs rounded to 2 decimal places
    tdsAmount = Math.round(tdsAmount * 100) / 100;
    const netPayableAmount = Math.round((amount - tdsAmount) * 100) / 100;

    return {
      section: section,
      transactionType: sectionName,
      applicableRate: `${applicableRate}%`,
      tdsAmount: tdsAmount,
      netPayableAmount: netPayableAmount,
      reason: reason
    };
  }

  /**
   * Helper to compute Annual Income Tax under New vs Old Tax Regime for FY 2025-26 & FY 2026-27
   */
  static calculateSalaryTax({ annualGross = 0, regime = 'NEW', deductions80C = 0, otherDeductions = 0 }) {
    // 1. Evaluate Standard Deduction
    const standardDeduction = (regime === 'NEW') ? 75000 : 50000;
    
    // 2. Evaluate Total Taxable Income
    let taxableIncome = annualGross - standardDeduction;
    if (regime === 'OLD') {
      const actual80C = Math.min(150000, deductions80C);
      taxableIncome = taxableIncome - actual80C - otherDeductions;
    }
    taxableIncome = Math.max(0, taxableIncome);

    let taxBeforeRebate = 0;

    // 3. Compute tax slabs
    if (regime === 'NEW') {
      // New Regime Slabs (FY 2025-26 & 2026-27):
      // Up to 4L: 0%
      // 4L to 8L: 5%
      // 8L to 12L: 10%
      // 12L to 16L: 15%
      // 16L to 20L: 20%
      // 20L to 24L: 25%
      // Above 24L: 30%
      if (taxableIncome > 2400000) {
        taxBeforeRebate += (taxableIncome - 2400000) * 0.30;
        taxBeforeRebate += 400000 * 0.25; // 20L to 24L
        taxBeforeRebate += 400000 * 0.20; // 16L to 20L
        taxBeforeRebate += 400000 * 0.15; // 12L to 16L
        taxBeforeRebate += 400000 * 0.10; // 8L to 12L
        taxBeforeRebate += 400000 * 0.05; // 4L to 8L
      } else if (taxableIncome > 2000000) {
        taxBeforeRebate += (taxableIncome - 2000000) * 0.25;
        taxBeforeRebate += 400000 * 0.20;
        taxBeforeRebate += 400000 * 0.15;
        taxBeforeRebate += 400000 * 0.10;
        taxBeforeRebate += 400000 * 0.05;
      } else if (taxableIncome > 1600000) {
        taxBeforeRebate += (taxableIncome - 1600000) * 0.20;
        taxBeforeRebate += 400000 * 0.15;
        taxBeforeRebate += 400000 * 0.10;
        taxBeforeRebate += 400000 * 0.05;
      } else if (taxableIncome > 1200000) {
        taxBeforeRebate += (taxableIncome - 1200000) * 0.15;
        taxBeforeRebate += 400000 * 0.10;
        taxBeforeRebate += 400000 * 0.05;
      } else if (taxableIncome > 800000) {
        taxBeforeRebate += (taxableIncome - 800000) * 0.10;
        taxBeforeRebate += 400000 * 0.05;
      } else if (taxableIncome > 400000) {
        taxBeforeRebate += (taxableIncome - 400000) * 0.05;
      }
    } else {
      // Old Regime Slabs:
      // Up to 2.5L: Nil
      // 2.5L to 5L: 5%
      // 5L to 10L: 20%
      // Above 10L: 30%
      if (taxableIncome > 1000000) {
        taxBeforeRebate += (taxableIncome - 1000000) * 0.30;
        taxBeforeRebate += 500000 * 0.20; // 5L to 10L
        taxBeforeRebate += 250000 * 0.05; // 2.5L to 5L
      } else if (taxableIncome > 500000) {
        taxBeforeRebate += (taxableIncome - 500000) * 0.20;
        taxBeforeRebate += 250000 * 0.05;
      } else if (taxableIncome > 250005) {
        taxBeforeRebate += (taxableIncome - 250000) * 0.05;
      }
    }

    // 4. Apply Section 87A Rebate
    let rebate = 0;
    if (regime === 'NEW') {
      // Rebate up to Rs. 60,000 for income up to Rs. 12 Lakhs
      if (taxableIncome <= 1200000) {
        rebate = taxBeforeRebate; // 100% tax rebate
      }
    } else {
      // Rebate up to Rs. 12,500 for income up to Rs. 5 Lakhs
      if (taxableIncome <= 500000) {
        rebate = taxBeforeRebate; // 100% tax rebate
      }
    }

    let netTax = Math.max(0, taxBeforeRebate - rebate);

    // 5. Add Health & Education Cess (4%)
    let cess = 0;
    if (netTax > 0) {
      cess = netTax * 0.04;
    }

    const totalTax = netTax + cess;
    const effectiveRate = annualGross > 0 ? (totalTax / annualGross) * 100 : 0;

    return {
      grossIncome: annualGross,
      standardDeduction: standardDeduction,
      taxableIncome: taxableIncome,
      taxBeforeRebate: Math.round(taxBeforeRebate * 100) / 100,
      rebateApplied: Math.round(rebate * 100) / 100,
      netTaxBeforeCess: Math.round(netTax * 100) / 100,
      cess: Math.round(cess * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      effectiveRate: Math.round(effectiveRate * 100) / 100
    };
  }
}

module.exports = TDSCalculator;
