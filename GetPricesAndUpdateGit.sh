echo Starting script...
cd "C:\Users\rco\Documents\Node Projects\TopRatedPhonesPtBestPrice"
ls -l
node schedulejobs.js
git status
git add -A
git commit -m "update prices"
git push origin master