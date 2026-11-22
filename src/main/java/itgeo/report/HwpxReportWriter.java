package itgeo.report;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.zip.CRC32;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.springframework.stereotype.Component;

import itgeo.to.AiReportTO;

/**
 * AI 현장 확인보고서 → 한글 HWPX (OWPML, zip + XML). 외부 라이브러리 없이 최소 구성만 만든다.
 *   mimetype(무압축, 맨 앞) · version.xml · META-INF/container.xml · META-INF/manifest.xml
 *   Contents/content.hpf · Contents/header.xml(글꼴 · 글자 모양 · 문단 모양) · Contents/section0.xml(본문) · settings.xml
 * 표 대신 문단으로 쓴다 (대상 시설은 "■ 항목 : 내용", 사용한 이력은 번호 매긴 문단). 서식은 한글에서 바로 고칠 수 있다.
 *
 * 글자 모양 charPr : 0 본문 10pt · 1 제목 18pt 굵게 · 2 소제목 12pt 굵게 · 3 안내 9pt 회색 · 4 항목명 10pt 굵게
 * 문단 모양 paraPr : 0 양쪽 정렬 · 1 가운데 · 2 소제목(위 12pt 띄움) · 3 들여쓰기
 */
@Component
public class HwpxReportWriter {

	private static final String NS = " xmlns:ha=\"http://www.hancom.co.kr/hwpml/2011/app\""
			+ " xmlns:hp=\"http://www.hancom.co.kr/hwpml/2011/paragraph\""
			+ " xmlns:hs=\"http://www.hancom.co.kr/hwpml/2011/section\""
			+ " xmlns:hc=\"http://www.hancom.co.kr/hwpml/2011/core\""
			+ " xmlns:hh=\"http://www.hancom.co.kr/hwpml/2011/head\""
			+ " xmlns:hpf=\"http://www.hancom.co.kr/schema/2011/hpf\""
			+ " xmlns:opf=\"http://www.idpf.org/2007/opf/\"";
	private static final String XML = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\" ?>";

	public byte[] write(AiReportTO rp) {
		try (ByteArrayOutputStream bos = new ByteArrayOutputStream(); ZipOutputStream zip = new ZipOutputStream(bos, StandardCharsets.UTF_8)) {
			stored(zip, "mimetype", "application/hwp+zip");
			put(zip, "version.xml", XML + "<hv:HCFVersion xmlns:hv=\"http://www.hancom.co.kr/hwpml/2011/version\" tagetApplication=\"WORDPROCESSOR\""
					+ " major=\"5\" minor=\"1\" micro=\"0\" buildNumber=\"1\" os=\"1\" xmlVersion=\"1.4\" application=\"Hancom Office Hangul\" appVersion=\"11, 0, 0, 0\"/>");
			put(zip, "META-INF/container.xml", XML + "<ocf:container xmlns:ocf=\"urn:oasis:names:tc:opendocument:xmlns:container\" xmlns:hpf=\"http://www.hancom.co.kr/schema/2011/hpf\">"
					+ "<ocf:rootfiles><ocf:rootfile full-path=\"Contents/content.hpf\" media-type=\"application/hwpml-package+xml\"/></ocf:rootfiles></ocf:container>");
			put(zip, "META-INF/manifest.xml", XML + "<odf:manifest xmlns:odf=\"urn:oasis:names:tc:opendocument:xmlns:manifest:1.0\"/>");
			put(zip, "Contents/content.hpf", XML + "<opf:package" + NS + " version=\"\" unique-identifier=\"\" id=\"\">"
					+ "<opf:metadata><opf:title>" + ReportHtml.esc(rp.getTitle()) + "</opf:title><opf:language>ko</opf:language>"
					+ "<opf:meta name=\"creator\" content=\"text\">ITGEO</opf:meta></opf:metadata>"
					+ "<opf:manifest>"
					+ "<opf:item id=\"header\" href=\"Contents/header.xml\" media-type=\"application/xml\"/>"
					+ "<opf:item id=\"section0\" href=\"Contents/section0.xml\" media-type=\"application/xml\"/>"
					+ "<opf:item id=\"settings\" href=\"settings.xml\" media-type=\"application/xml\"/>"
					+ "</opf:manifest><opf:spine>"
					+ "<opf:itemref idref=\"header\" linear=\"yes\"/><opf:itemref idref=\"section0\" linear=\"yes\"/>"
					+ "</opf:spine></opf:package>");
			put(zip, "Contents/header.xml", header());
			put(zip, "Contents/section0.xml", section(rp));
			put(zip, "settings.xml", XML + "<ha:HWPApplicationSetting xmlns:ha=\"http://www.hancom.co.kr/hwpml/2011/app\" xmlns:config=\"urn:oasis:names:tc:opendocument:xmlns:config:1.0\">"
					+ "<ha:CaretPosition listIDRef=\"0\" paraIDRef=\"0\" pos=\"0\"/></ha:HWPApplicationSetting>");
			zip.finish();
			return bos.toByteArray();
		} catch (IOException e) {
			throw new IllegalStateException("한글(HWPX) 파일을 만들지 못했습니다.");
		}
	}

	// ---------- 본문 ----------

	String section(AiReportTO rp) {
		Body b = new Body();
		b.para(1, 1, "현장 확인보고서");
		b.para(1, 3, rp.getTitle() + " · 작성 " + rp.getCreatedAt() + (rp.getWriter() == null || rp.getWriter().isBlank() ? "" : " · " + rp.getWriter()));
		b.para(0, 0, "");
		for (String[] f : rp.getFacts()) b.labeled(3, "■ " + f[0] + " : ", f[1]);
		for (AiReportTO.Section s : rp.getSections()) {
			b.para(2, 2, s.getHeading());
			for (String line : (s.getBody() == null ? "" : s.getBody()).split("\\r?\\n")) {
				if (!line.isBlank()) b.para(0, 0, line.trim());
			}
		}
		b.para(2, 2, "붙임. 사용한 현장조사이력 (" + rp.getRecordCnt() + "건)");
		int i = 1;
		for (String[] r : rp.getHistory()) {
			b.labeled(0, "(" + (i++) + ") " + r[0], " · 담당자 " + r[1] + " · 방문 결과 " + r[2]);
			b.labeled(3, "현장 체크 : ", r[3]);
			b.labeled(3, "관찰 메모 : ", r[4]);
		}
		b.para(0, 0, "");
		b.para(0, 3, "이 보고서의 본문(1 ~ 5)은 현장조사이력을 바탕으로 AI 가 정리한 초안입니다. 담당자가 사실관계를 확인한 뒤 사용해 주세요.");
		return XML + "<hs:sec" + NS + ">" + b.sb + "</hs:sec>";
	}

	/** 문단 쌓기. 첫 문단에 쪽 설정(secPr)을 넣는다 */
	private static final class Body {
		final StringBuilder sb = new StringBuilder();
		int id = 0;

		void para(int paraPr, int charPr, String text) {
			open(paraPr);
			sb.append("<hp:run charPrIDRef=\"").append(charPr).append("\">");
			if (id == 1) sb.append(SEC_PR);
			sb.append("<hp:t>").append(ReportHtml.esc(text)).append("</hp:t></hp:run></hp:p>");
		}

		/** 앞부분 굵게(charPr 4) + 뒷부분 보통(charPr 0) */
		void labeled(int paraPr, String label, String text) {
			open(paraPr);
			sb.append("<hp:run charPrIDRef=\"4\">");
			if (id == 1) sb.append(SEC_PR);
			sb.append("<hp:t>").append(ReportHtml.esc(label)).append("</hp:t></hp:run>");
			sb.append("<hp:run charPrIDRef=\"0\"><hp:t>").append(ReportHtml.esc(text)).append("</hp:t></hp:run></hp:p>");
		}

		private void open(int paraPr) {
			sb.append("<hp:p id=\"").append(id == 0 ? "0" : String.valueOf(1000 + id)).append("\" paraPrIDRef=\"").append(paraPr)
					.append("\" styleIDRef=\"0\" pageBreak=\"0\" columnBreak=\"0\" merged=\"0\">");
			id++;
		}
	}

	/** A4 세로, 여백 위 20 · 아래 15 · 좌우 30mm (HWPUNIT = 1/7200 인치) */
	private static final String SEC_PR = "<hp:secPr id=\"\" textDirection=\"HORIZONTAL\" spaceColumns=\"1134\" tabStop=\"8000\" tabStopVal=\"4000\" tabStopUnit=\"HWPUNIT\""
			+ " outlineShapeIDRef=\"0\" memoShapeIDRef=\"0\" textVerticalWidthHead=\"0\" masterPageCnt=\"0\">"
			+ "<hp:grid lineGrid=\"0\" charGrid=\"0\" wonggojiFormat=\"0\"/>"
			+ "<hp:startNum pageStartsOn=\"BOTH\" page=\"0\" pic=\"0\" tbl=\"0\" equation=\"0\"/>"
			+ "<hp:visibility hideFirstHeader=\"0\" hideFirstFooter=\"0\" hideFirstMasterPage=\"0\" border=\"SHOW_ALL\" fill=\"SHOW_ALL\""
			+ " hideFirstPageNum=\"0\" hideFirstEmptyLine=\"0\" showLineNumber=\"0\"/>"
			+ "<hp:lineNumberShape restartType=\"0\" countBy=\"0\" distance=\"0\" startNumber=\"0\"/>"
			+ "<hp:pagePr landscape=\"WIDELY\" width=\"59528\" height=\"84186\" gutterType=\"LEFT_ONLY\">"
			+ "<hp:margin header=\"4252\" footer=\"4252\" gutter=\"0\" left=\"8504\" right=\"8504\" top=\"5668\" bottom=\"4252\"/></hp:pagePr>"
			+ "<hp:footNotePr><hp:autoNumFormat type=\"DIGIT\" userChar=\"\" prefixChar=\"\" suffixChar=\")\" supscript=\"0\"/>"
			+ "<hp:noteLine length=\"-1\" type=\"SOLID\" width=\"0.12 mm\" color=\"#000000\"/>"
			+ "<hp:noteSpacing betweenNotes=\"283\" belowLine=\"567\" aboveLine=\"850\"/>"
			+ "<hp:numbering type=\"CONTINUOUS\" newNum=\"1\"/><hp:placement place=\"EACH_COLUMN\" beneathText=\"0\"/></hp:footNotePr>"
			+ "<hp:endNotePr><hp:autoNumFormat type=\"DIGIT\" userChar=\"\" prefixChar=\"\" suffixChar=\")\" supscript=\"0\"/>"
			+ "<hp:noteLine length=\"14692344\" type=\"SOLID\" width=\"0.12 mm\" color=\"#000000\"/>"
			+ "<hp:noteSpacing betweenNotes=\"0\" belowLine=\"567\" aboveLine=\"850\"/>"
			+ "<hp:numbering type=\"CONTINUOUS\" newNum=\"1\"/><hp:placement place=\"END_OF_DOCUMENT\" beneathText=\"0\"/></hp:endNotePr>"
			+ pageBorder("BOTH") + pageBorder("EVEN") + pageBorder("ODD")
			+ "</hp:secPr>"
			+ "<hp:ctrl><hp:colPr id=\"\" type=\"NEWSPAPER\" layout=\"LEFT\" colCount=\"1\" sameSz=\"1\" sameGap=\"0\"/></hp:ctrl>";

	private static String pageBorder(String type) {
		return "<hp:pageBorderFill type=\"" + type + "\" borderFillIDRef=\"1\" textBorder=\"PAPER\" headerInside=\"0\" footerInside=\"0\" fillArea=\"PAPER\">"
				+ "<hp:offset left=\"1417\" right=\"1417\" top=\"1417\" bottom=\"1417\"/></hp:pageBorderFill>";
	}

	// ---------- 머리 (글꼴 · 모양) ----------

	String header() {
		StringBuilder h = new StringBuilder(XML);
		h.append("<hh:head").append(NS).append(" version=\"1.4\" secCnt=\"1\">");
		h.append("<hh:beginNum page=\"1\" footnote=\"1\" endnote=\"1\" pic=\"1\" tbl=\"1\" equation=\"1\"/>");
		h.append("<hh:refList>");

		h.append("<hh:fontfaces itemCnt=\"7\">");
		for (String lang : new String[] { "HANGUL", "LATIN", "HANJA", "JAPANESE", "OTHER", "SYMBOL", "USER" }) {
			h.append("<hh:fontface lang=\"").append(lang).append("\" fontCnt=\"1\">")
					.append("<hh:font id=\"0\" face=\"맑은 고딕\" type=\"TTF\" isEmbedded=\"0\"/></hh:fontface>");
		}
		h.append("</hh:fontfaces>");

		h.append("<hh:borderFills itemCnt=\"2\">").append(borderFill(1, false)).append(borderFill(2, true)).append("</hh:borderFills>");

		h.append("<hh:charProperties itemCnt=\"5\">");
		h.append(charPr(0, 1000, false, "#000000"));
		h.append(charPr(1, 1800, true, "#000000"));
		h.append(charPr(2, 1200, true, "#000000"));
		h.append(charPr(3, 900, false, "#555555"));
		h.append(charPr(4, 1000, true, "#000000"));
		h.append("</hh:charProperties>");

		h.append("<hh:tabProperties itemCnt=\"1\"><hh:tabPr id=\"0\" autoTabLeft=\"0\" autoTabRight=\"0\"/></hh:tabProperties>");

		h.append("<hh:paraProperties itemCnt=\"4\">");
		h.append(paraPr(0, "JUSTIFY", 0, 0, 200));
		h.append(paraPr(1, "CENTER", 0, 0, 400));
		h.append(paraPr(2, "LEFT", 0, 1200, 400));
		h.append(paraPr(3, "LEFT", 1000, 0, 100));
		h.append("</hh:paraProperties>");

		h.append("<hh:styles itemCnt=\"1\"><hh:style id=\"0\" type=\"PARA\" name=\"바탕글\" engName=\"Normal\" paraPrIDRef=\"0\" charPrIDRef=\"0\""
				+ " nextStyleIDRef=\"0\" langID=\"1042\" lockForm=\"0\"/></hh:styles>");
		h.append("</hh:refList>");
		h.append("<hh:compatibleDocument targetProgram=\"HWP201X\"><hh:layoutCompatibility/></hh:compatibleDocument>");
		h.append("<hh:docOption><hh:linkinfo path=\"\" pageInherit=\"0\" footnoteInherit=\"0\"/></hh:docOption>");
		h.append("<hh:trackchageConfig flags=\"56\"/>");
		h.append("</hh:head>");
		return h.toString();
	}

	private static String borderFill(int id, boolean brush) {
		return "<hh:borderFill id=\"" + id + "\" threeD=\"0\" shadow=\"0\" centerLine=\"NONE\" breakCellSeparateLine=\"0\">"
				+ "<hh:slash type=\"NONE\" Crooked=\"0\" isCounter=\"0\"/><hh:backSlash type=\"NONE\" Crooked=\"0\" isCounter=\"0\"/>"
				+ "<hh:leftBorder type=\"NONE\" width=\"0.1 mm\" color=\"#000000\"/><hh:rightBorder type=\"NONE\" width=\"0.1 mm\" color=\"#000000\"/>"
				+ "<hh:topBorder type=\"NONE\" width=\"0.1 mm\" color=\"#000000\"/><hh:bottomBorder type=\"NONE\" width=\"0.1 mm\" color=\"#000000\"/>"
				+ "<hh:diagonal type=\"SOLID\" width=\"0.1 mm\" color=\"#000000\"/>"
				+ (brush ? "<hc:fillBrush><hc:winBrush faceColor=\"none\" hatchColor=\"#999999\" alpha=\"0\"/></hc:fillBrush>" : "")
				+ "</hh:borderFill>";
	}

	private static String charPr(int id, int height, boolean bold, String color) {
		String seven0 = " hangul=\"0\" latin=\"0\" hanja=\"0\" japanese=\"0\" other=\"0\" symbol=\"0\" user=\"0\"/>";
		String seven100 = " hangul=\"100\" latin=\"100\" hanja=\"100\" japanese=\"100\" other=\"100\" symbol=\"100\" user=\"100\"/>";
		return "<hh:charPr id=\"" + id + "\" height=\"" + height + "\" textColor=\"" + color + "\" shadeColor=\"none\" useFontSpace=\"0\" useKerning=\"0\" symMark=\"NONE\" borderFillIDRef=\"2\">"
				+ "<hh:fontRef" + seven0 + "<hh:ratio" + seven100 + "<hh:spacing" + seven0 + "<hh:relSz" + seven100 + "<hh:offset" + seven0
				+ (bold ? "<hh:bold/>" : "")
				+ "<hh:underline type=\"NONE\" shape=\"SOLID\" color=\"#000000\"/><hh:strikeout shape=\"NONE\" color=\"#000000\"/>"
				+ "<hh:outline type=\"NONE\"/><hh:shadow type=\"NONE\" color=\"#B2B2B2\" offsetX=\"10\" offsetY=\"10\"/></hh:charPr>";
	}

	private static String paraPr(int id, String align, int left, int prev, int next) {
		return "<hh:paraPr id=\"" + id + "\" tabPrIDRef=\"0\" condense=\"0\" fontLineHeight=\"0\" snapToGrid=\"1\" suppressLineNumbers=\"0\" checked=\"0\">"
				+ "<hh:align horizontal=\"" + align + "\" vertical=\"BASELINE\"/>"
				+ "<hh:heading type=\"NONE\" idRef=\"0\" level=\"0\"/>"
				+ "<hh:breakSetting breakLatinWord=\"KEEP_WORD\" breakNonLatinWord=\"KEEP_WORD\" widowOrphan=\"0\" keepWithNext=\"0\" keepLines=\"0\" pageBreakBefore=\"0\" lineWrap=\"BREAK\"/>"
				+ "<hh:autoSpacing eAsianEng=\"0\" eAsianNum=\"0\"/>"
				+ "<hh:margin><hc:intent value=\"0\" unit=\"HWPUNIT\"/><hc:left value=\"" + left + "\" unit=\"HWPUNIT\"/><hc:right value=\"0\" unit=\"HWPUNIT\"/>"
				+ "<hc:prev value=\"" + prev + "\" unit=\"HWPUNIT\"/><hc:next value=\"" + next + "\" unit=\"HWPUNIT\"/></hh:margin>"
				+ "<hh:lineSpacing type=\"PERCENT\" value=\"160\" unit=\"HWPUNIT\"/>"
				+ "<hh:border borderFillIDRef=\"2\" offsetLeft=\"0\" offsetRight=\"0\" offsetTop=\"0\" offsetBottom=\"0\" connect=\"0\" ignoreMargin=\"0\"/>"
				+ "</hh:paraPr>";
	}

	// ---------- zip ----------

	private static void put(ZipOutputStream zip, String name, String content) throws IOException {
		zip.putNextEntry(new ZipEntry(name));
		zip.write(content.getBytes(StandardCharsets.UTF_8));
		zip.closeEntry();
	}

	/** mimetype 은 압축하지 않고 맨 앞에 (한글이 형식을 알아보는 방법) */
	private static void stored(ZipOutputStream zip, String name, String content) throws IOException {
		byte[] b = content.getBytes(StandardCharsets.US_ASCII);
		ZipEntry e = new ZipEntry(name);
		e.setMethod(ZipEntry.STORED);
		e.setSize(b.length);
		e.setCompressedSize(b.length);
		CRC32 crc = new CRC32();
		crc.update(b);
		e.setCrc(crc.getValue());
		zip.putNextEntry(e);
		zip.write(b);
		zip.closeEntry();
	}
}
