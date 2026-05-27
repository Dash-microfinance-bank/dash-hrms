import React from 'react'
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { formatPayslipCurrency } from '@/lib/payslips/format'
import type { PayslipViewModel } from '@/lib/payslips/types'

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 48,
    paddingHorizontal: 32,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#000',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 80,
    objectFit: 'contain',
  },
  periodBlock: {
    alignItems: 'center',
  },
  periodSub: {
    fontSize: 9,
    color: '#666',
    marginBottom: 4,
  },
  periodTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  orgName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  orgLine: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    marginBottom: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 24,
    marginBottom: 24,
  },
  detailCol: {
    flex: 1,
  },
  detailLine: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  detailLabel: {
    width: 120,
    color: '#666',
    fontSize: 9,
  },
  detailValue: {
    flex: 1,
    fontSize: 9,
  },
  breakdownBox: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  breakdownCol: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    borderStyle: 'dashed',
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 9,
    color: '#666',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  tableCellLabel: {
    flex: 1,
    fontSize: 9,
    color: '#666',
  },
  tableCellValue: {
    flex: 1,
    fontSize: 9,
  },
  tableFooter: {
    flexDirection: 'row',
    paddingTop: 6,
    marginTop: 4,
  },
  tableFooterLabel: {
    flex: 1,
    fontSize: 9,
    fontWeight: 'bold',
    color: '#666',
  },
  tableFooterValue: {
    flex: 1,
    fontSize: 9,
    fontWeight: 'bold',
  },
  netBox: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  netLabel: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 32,
    right: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 8,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
})

function LineItemsTable({
  title,
  items,
  totalLabel,
  totalAmount,
}: {
  title: string
  items: { name: string; amount: number }[]
  totalLabel: string
  totalAmount: number
}) {
  return (
    <View style={styles.breakdownCol}>
      <View style={styles.tableHeader}>
        <Text style={styles.tableHeaderCell}>{title}</Text>
        <Text style={styles.tableHeaderCell}>Amount</Text>
      </View>
      {items.length === 0 ? (
        <View style={styles.tableRow}>
          <Text style={styles.tableCellLabel}>—</Text>
        </View>
      ) : (
        items.map((line) => (
          <View key={`${line.name}-${line.amount}`} style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>{line.name}</Text>
            <Text style={styles.tableCellValue}>{formatPayslipCurrency(line.amount)}</Text>
          </View>
        ))
      )}
      <View style={styles.tableFooter}>
        <Text style={styles.tableFooterLabel}>{totalLabel}</Text>
        <Text style={styles.tableFooterValue}>{formatPayslipCurrency(totalAmount)}</Text>
      </View>
    </View>
  )
}

export function PayslipPdfDocument({ data }: { data: PayslipViewModel }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <Image src={data.logoUrl} style={styles.logo} />
          <View style={styles.periodBlock}>
            <Text style={styles.periodSub}>Payslip for the month</Text>
            <Text style={styles.periodTitle}>{data.periodLabel}</Text>
          </View>
        </View>

        <View>
          <Text style={styles.orgName}>{data.organizationName}</Text>
          {data.organizationAddressLines.map((line) => (
            <Text key={line} style={styles.orgLine}>
              {line}
            </Text>
          ))}
        </View>

        <View style={{ marginTop: 32 }}>
          <Text style={styles.sectionTitle}>Employee Details</Text>
          <View style={styles.hr} />
          <View style={styles.detailsRow}>
            <View style={styles.detailCol}>
              <View style={styles.detailLine}>
                <Text style={styles.detailLabel}>Employee ID</Text>
                <Text style={styles.detailValue}>: {data.employeeStaffId}</Text>
              </View>
              <View style={styles.detailLine}>
                <Text style={styles.detailLabel}>Employee Name</Text>
                <Text style={styles.detailValue}>: {data.employeeName}</Text>
              </View>
              <View style={styles.detailLine}>
                <Text style={styles.detailLabel}>Employee Department</Text>
                <Text style={styles.detailValue}>: {data.department}</Text>
              </View>
            </View>
            <View style={styles.detailCol}>
              <View style={styles.detailLine}>
                <Text style={styles.detailLabel}>Position</Text>
                <Text style={styles.detailValue}>: {data.position}</Text>
              </View>
              <View style={styles.detailLine}>
                <Text style={styles.detailLabel}>Contract</Text>
                <Text style={styles.detailValue}>: {data.contractLabel}</Text>
              </View>
              <View style={styles.detailLine}>
                <Text style={styles.detailLabel}>Pay day</Text>
                <Text style={styles.detailValue}>: {data.payDayLabel}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Salary Breakdown</Text>
          <View style={styles.breakdownBox}>
            <LineItemsTable
              title="Allowances"
              items={data.allowances}
              totalLabel="Total Allowances"
              totalAmount={data.totalAllowances}
            />
            <LineItemsTable
              title="Deductions"
              items={data.deductions}
              totalLabel="Total Deductions"
              totalAmount={data.totalDeductions}
            />
          </View>

          <View style={styles.netBox}>
            <Text style={styles.netLabel}>Net Salary</Text>
            <Text style={styles.netLabel}>{formatPayslipCurrency(data.netSalary)}</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            This is a computer generated payslip. No signature is required.
          </Text>
          <Text style={styles.footerText}>Powered by DashMFB</Text>
        </View>
      </Page>
    </Document>
  )
}
