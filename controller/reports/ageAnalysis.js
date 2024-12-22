const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const { generateReport } = require("./generateReportHelper");
 // Assuming your helper function is in `reportHelpers.js`

// Generate Age Analysis Report and provide links for each category
const ageAnalysisReport = async (req, res) => {
  try {
    // Fetch all active customers with outstanding balances
    const customers = await prisma.customer.findMany({
      where: {
        status: "ACTIVE",
        closingBalance: {
          gt: 0, // Only include customers with a positive balance (owing money)
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        monthlyCharge: true,
        closingBalance: true,
        garbageCollectionDay: true,
      },
    });

    const ageBuckets = {
      "1 Month": [],
      "2 Months": [],
      "3 Months": [],
      "4 Months": [],
      "5 Months": [],
      "6+ Months": [],
    };

    customers.forEach((customer) => {
      const monthsOwed = Math.ceil(customer.closingBalance / customer.monthlyCharge);
      const bucket =
  monthsOwed <= 1
    ? "1 Month"
    : monthsOwed <= 2
    ? "2 Months"
    : monthsOwed <= 3
    ? "3 Months"
    : monthsOwed <= 4
    ? "4 Months"
    : monthsOwed <= 5
    ? "5 Months"
    : "6+ Months";


      ageBuckets[bucket].push(customer);
    });

    const response = {
      message: "Age Analysis Report Generated Successfully",
      summary: Object.keys(ageBuckets).map((bucket) => ({
        bucket,
        customerCount: ageBuckets[bucket].length,
        downloadLink: `${req.protocol}://${req.get("host")}/age-analysis/download?category=${encodeURIComponent(
          bucket
        )}`,
      })),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error generating age analysis report:", error);
    res.status(500).json({ message: "Error generating report", error: error.message });
  }
};

// Download the PDF for a specific category
const downloadAgeAnalysisReport = async (req, res) => {
  const { category } = req.query;

  if (!category) {
    return res.status(400).json({ error: "Category is required" });
  }

  try {
    const customers = await prisma.customer.findMany({
      where: {
        status: "ACTIVE",
        closingBalance: {
          gt: 0,
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        monthlyCharge: true,
        closingBalance: true,
        garbageCollectionDay: true,
      },
    });

    const monthsOwed = {
      "1 Month": 1,
      "2 Months": 2,
      "3 Months": 3,
      "4 Months": 4,
      "5 Months": 5,
      "6+ Months": Infinity,
    };

    const filteredCustomers = customers.filter((customer) => {
      const calculatedMonthsOwed = Math.ceil(customer.closingBalance / customer.monthlyCharge);
      if (category === "6+ Months") {
        return calculatedMonthsOwed > 5;
      }
      return calculatedMonthsOwed === monthsOwed[category];
    });

    if (filteredCustomers.length === 0) {
      return res.status(404).json({ error: "No customers found for this category." });
    }

    const title = `Age Analysis Report - ${category}`;
    const fileName = `Age_Analysis_${category.replace(/\s+/g, "_")}`;

    await generateReport(filteredCustomers, title, fileName, res);
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
};

module.exports = {
  ageAnalysisReport,
  downloadAgeAnalysisReport,
};
