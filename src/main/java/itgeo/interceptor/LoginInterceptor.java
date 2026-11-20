package itgeo.interceptor;

import org.springframework.web.servlet.HandlerInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

public class LoginInterceptor implements HandlerInterceptor {

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
			throws Exception {
		//session에서 loginMember를 가져온다. 있으면 true 리턴 없으면 loginform으로 redirect
		HttpSession session = request.getSession();
		Object loginMember = session.getAttribute("loginMember");
		System.out.println("session loginMember=" + loginMember);
		if(loginMember != null) {
			return true;
		}
		// JSON API(api/...do, 모바일 앱 포함)는 로그인 화면으로 보내지 않고 401 + {ok:false}
		if (request.getRequestURI().contains("/api/")) {
			response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
			response.setContentType("application/json;charset=UTF-8");
			response.getWriter().write("{\"ok\":false,\"login\":false,\"msg\":\"로그인이 필요합니다.\"}");
			return false;
		}
		String contextPath = request.getContextPath();
		response.sendRedirect(contextPath + "/loginform.do");
		return false;

	}
}
