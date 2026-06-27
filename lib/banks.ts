export interface BankBranch {
  branchName: string;
  ifscCode: string;
}

export interface BankData {
  bankName: string;
  branches: BankBranch[];
}

export const BANK_LIST: BankData[] = [
  {
    bankName: "State Bank of India",
    branches: [
      { branchName: "Surat Main Branch", ifscCode: "SBIN0000488" },
      { branchName: "Surat Ring Road", ifscCode: "SBIN0003041" },
      { branchName: "Surat Textile Market", ifscCode: "SBIN0008234" },
      { branchName: "Adajan Surat Branch", ifscCode: "SBIN0060375" },
    ],
  },
  {
    bankName: "HDFC Bank",
    branches: [
      { branchName: "Surat Main Branch", ifscCode: "HDFC0000067" },
      { branchName: "Surat Ring Road", ifscCode: "HDFC0000192" },
      { branchName: "Surat Textile Market", ifscCode: "HDFC0001235" },
    ],
  },
  {
    bankName: "ICICI Bank",
    branches: [
      { branchName: "Surat Ring Road", ifscCode: "ICIC0000108" },
      { branchName: "Surat Textile Market", ifscCode: "ICIC0002341" },
      { branchName: "Adajan Surat", ifscCode: "ICIC0001815" },
    ],
  },
  {
    bankName: "Axis Bank",
    branches: [
      { branchName: "Surat Main Branch", ifscCode: "UTIB0000072" },
      { branchName: "Surat Ring Road", ifscCode: "UTIB0000214" },
    ],
  },
  {
    bankName: "Bank of Baroda",
    branches: [
      { branchName: "Surat Main Branch", ifscCode: "BARB0SURATM" },
      { branchName: "Surat Ring Road", ifscCode: "BARB0RINGRO" },
    ],
  },
];
