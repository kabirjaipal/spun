1.  in company setup in m company module sub type add manufactiring option
2.  in setup company allow user to setup multiple companies at a same time during onboaring and use accoridng to for each company and also allow user to swtitch companiy in the header on dashboard and so user can switch between companies and see data of each companies
3.  in setup company bank account information section if user fill its custom bank account details and branhc then save it so he don't need to put same again just select
4.  rename /companies page into parties and remove /customers page no use  bcz customers = parties 
5. in company setup add msme reigstration and its number for the all companies 
6.  on /inventory page in inventory items add a new btn add your formula near add item btn and whre show input = input like 1 meter cloth = 3 leter color  and store in db and use sheet 
7.  by default in all date fields we are using by default select today date 
8.   for broker and haste create one table with column name and type and poopular from table in ui and allow creation too wherrever haste and broker dropdown is exist llike /purchase page 
9.  on /purchase page in purhcaes item section remove `expense ledger`  and swap gst rate and taxable inputs position and replace qty with meter and unit select menu with option pcs and meter and if in unit meter select pick meter value and if pcs then pick pcs value for calcualtion in taxable and net amount and on job outward page rename per with unit
10.  if i sellect my own state company then apply CGST and SGST and if user select company state is diff from my company state then apply IGST and not apply CGST and SGST and convert CGST AND SGST AND IGST input to percetage
11.  add sales return page too
12.  on /purchage return page make select invoices to return to select component and in items to return table by default table will be read only and show edit btn near delete icon if user click show same table below but editable and make invoice no and item read only and for voucher type use purchase return 
13. for each voucher type we have to use diff table to maintain sequace for each voucher type and show on purchase return and sales return page or other page whre needed read only
14. on /purchase return page in items line table row for pcs we have to show popular so if user type 5 pcs then user can each type meter for each cps like 12,42,53 and hwen user click on save then save each peaces in table and then popup close total the meter and show in qutanity column
15.  add fold input on purchase return page like job outward and it must be ahead of pcs and qtuality all pages where pcs and qiuality exist
16. on page /job-inward we have shortage column in fabirc details ui show as % not pcs and do same in other pages where shortage exist
17. on pages where fold input exist we have to show 2 columns for amount and net amount and in amount ruppers formula ( unit * rate ) and net amount formula ( (unit * rate * fold) / 100 )
18. don't show ledger in such table purchases and job outward etc don't show ledger related input in tables
19. in purchases and sales page we have to add discount system in which we will show 2 input for discount both will be optionla and discount can be in money or % and user can select via select and then we will show total after discount applied in table for all items total
20. in companies page for create/edit add msme registaton too and add due_day column  and we put 10 days and if user purachase/sales with this company like today then till 10 days user have to pay us if not paid 10 days then in column pending_due_day we will update like on 11 day it will 1 on 12day it will be 2
21.  on /purchase page party creation is bad it should be as /companies page or may be reidrect to that page and creation and come back or do on this page whichever is best and also impvoe ui of below tables its so overlapping
22. on /job outward page in user can crate job party on this page or rediect to gatway job master section whichever is good and add gst number and its details /job outward page and and add hsn code in table and remove ledger 
23.   on job inward page add hsn code in table and remove ledger
24. on mill outward page user can crate mill party on gateway mill master page or do on job mil outward page whivver is good and broker and haste make select like purchase page
25. on gateway / group master section show parent group child group in heircracy so user don't need to scroll just show child group below parent group